import type { SQLiteDatabase } from 'expo-sqlite';
import TazalaScanner, { type AssetAnalysis, type ScanCompleteEvent } from 'tazala-scanner';

import { LIST_PAGE_SIZE, SCAN_BATCH_SIZE, SCAN_CONCURRENCY, SIMILARITY_WINDOW_MS } from '@/config';
import { clearAnalysis, getAssetsNeedingAnalysis, saveAnalyses } from '@/db/analysisRepository';
import { deleteUnseenAssets, upsertAssets } from '@/db/assetsRepository';
import { getDatabase } from '@/db/database';
import { replaceGroups } from '@/db/groupsRepository';
import { writeValue } from '@/db/keyValueRepository';
import { useLibraryStore } from '@/stores/libraryStore';
import { useScanStore, type ScanMetrics } from '@/stores/scanStore';
import { useSettingsStore } from '@/stores/settingsStore';

export interface RunScanOptions {
  full?: boolean;
  measureMemory?: boolean;
}

class ScanCancelledError extends Error {
  constructor() {
    super('Scan cancelled');
  }
}

let running: Promise<ScanMetrics | null> | null = null;
let cancelRequested = false;

export function isScanRunning(): boolean {
  return running !== null;
}

export function runScan(options: RunScanOptions = {}): Promise<ScanMetrics | null> {
  if (running) {
    return running;
  }
  cancelRequested = false;
  running = execute(options).finally(() => {
    running = null;
  });
  return running;
}

export function cancelScan(): void {
  cancelRequested = true;
  TazalaScanner.cancelScan();
  useScanStore.getState().set({ paused: false });
}

export function pauseScan(): void {
  TazalaScanner.pauseScan();
  useScanStore.getState().set({ paused: true });
}

export function resumeScan(): void {
  TazalaScanner.resumeScan();
  useScanStore.getState().set({ paused: false });
}

export async function regroup(): Promise<void> {
  if (running) {
    return;
  }
  const db = await getDatabase();
  await groupSimilar(db);
  await useLibraryStore.getState().refresh();
}

function throwIfCancelled(): void {
  if (cancelRequested) {
    throw new ScanCancelledError();
  }
}

async function execute(options: RunScanOptions): Promise<ScanMetrics | null> {
  const store = useScanStore.getState();
  const startedAt = Date.now();
  const memory = options.measureMemory ? startMemorySampler() : null;
  const metrics: ScanMetrics = {
    startedAt,
    syncMs: 0,
    listedAssets: 0,
    analyzeMs: 0,
    analyzedAssets: 0,
    groupingMs: 0,
    comparisons: 0,
    similarGroups: 0,
    duplicateGroups: 0,
    peakMemoryBytes: 0,
    totalMs: 0,
    cancelled: false,
  };
  store.set({ phase: 'syncing', processed: 0, total: 0, paused: false, error: null });

  try {
    const db = await getDatabase();
    if (options.full) {
      await clearAnalysis(db);
    }

    const syncStarted = Date.now();
    metrics.listedAssets = await syncLibrary(db);
    metrics.syncMs = Date.now() - syncStarted;
    await useLibraryStore.getState().refresh();
    throwIfCancelled();

    const analyzeStarted = Date.now();
    const analysis = await analyzeStale(db);
    metrics.analyzedAssets = analysis.processed;
    metrics.analyzeMs = Date.now() - analyzeStarted;
    metrics.cancelled = analysis.cancelled;
    throwIfCancelled();

    useScanStore.getState().set({ phase: 'grouping' });
    const groupingStarted = Date.now();
    const grouping = await groupSimilar(db);
    metrics.groupingMs = Date.now() - groupingStarted;
    metrics.comparisons = grouping.comparisons;
    metrics.similarGroups = grouping.similar;
    metrics.duplicateGroups = grouping.duplicates;

    await writeValue(db, 'stats', 'lastScanAt', String(Date.now()));
    await useLibraryStore.getState().refresh();
  } catch (error) {
    if (error instanceof ScanCancelledError) {
      metrics.cancelled = true;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      useScanStore.getState().set({ error: message });
    }
    await useLibraryStore
      .getState()
      .refresh()
      .catch(() => undefined);
  } finally {
    metrics.peakMemoryBytes = memory?.stop() ?? 0;
    metrics.totalMs = Date.now() - startedAt;
    useScanStore.getState().set({ phase: 'idle', paused: false, lastMetrics: metrics });
  }
  return metrics;
}

async function syncLibrary(db: SQLiteDatabase): Promise<number> {
  const generation = Date.now();
  let offset = 0;
  let listed = 0;
  for (;;) {
    throwIfCancelled();
    const page = await TazalaScanner.listAssets(offset, LIST_PAGE_SIZE);
    if (page.length > 0) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await upsertAssets(txn, page, generation);
      });
    }
    listed += page.length;
    offset += page.length;
    useScanStore.getState().set({ processed: listed });
    if (page.length < LIST_PAGE_SIZE) break;
  }
  throwIfCancelled();
  await deleteUnseenAssets(db, generation);
  return listed;
}

async function analyzeStale(
  db: SQLiteDatabase,
): Promise<{ processed: number; cancelled: boolean }> {
  const stale = await getAssetsNeedingAnalysis(db, TazalaScanner.analysisVersion);
  if (stale.length === 0) {
    return { processed: 0, cancelled: false };
  }
  const modifiedAtById = new Map(stale.map((asset) => [asset.id, asset.modified_at]));
  useScanStore.getState().set({ phase: 'analyzing', processed: 0, total: stale.length });

  let writeQueue: Promise<void> = Promise.resolve();
  let writeError: unknown = null;
  const enqueueWrite = (analyses: AssetAnalysis[]) => {
    writeQueue = writeQueue
      .then(() => saveAnalyses(db, analyses, modifiedAtById, Date.now()))
      .catch((error: unknown) => {
        writeError = error;
        TazalaScanner.cancelScan();
      });
  };

  const completion = new Promise<ScanCompleteEvent>((resolve, reject) => {
    const subscriptions = [
      TazalaScanner.addListener('onScanBatch', (event) => enqueueWrite(event.analyses)),
      TazalaScanner.addListener('onScanProgress', (event) =>
        useScanStore.getState().set({ processed: event.processed, total: event.total }),
      ),
      TazalaScanner.addListener('onScanComplete', (event) => {
        subscriptions.forEach((subscription) => subscription.remove());
        resolve(event);
      }),
      TazalaScanner.addListener('onScanError', (event) => {
        subscriptions.forEach((subscription) => subscription.remove());
        reject(new Error(event.message));
      }),
    ];
    TazalaScanner.startScan({
      assetIds: stale.map((asset) => asset.id),
      batchSize: SCAN_BATCH_SIZE,
      concurrency: SCAN_CONCURRENCY,
    }).catch((error: unknown) => {
      subscriptions.forEach((subscription) => subscription.remove());
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });

  const result = await completion;
  await writeQueue;
  if (writeError) {
    throw writeError instanceof Error ? writeError : new Error(String(writeError));
  }
  await useLibraryStore.getState().refresh();
  return { processed: result.processed, cancelled: result.cancelled };
}

async function groupSimilar(
  db: SQLiteDatabase,
): Promise<{ similar: number; duplicates: number; comparisons: number }> {
  const level = useSettingsStore.getState().similarityLevel;
  const similar = await TazalaScanner.findSimilarGroups({
    databasePath: db.databasePath,
    level,
    windowMs: SIMILARITY_WINDOW_MS,
  });
  const counts = await replaceGroups(db, similar.groups, similar.duplicates);
  return { ...counts, comparisons: similar.comparisons };
}

function startMemorySampler(): { stop: () => number } {
  let peak = safeMemory();
  const timer = setInterval(() => {
    peak = Math.max(peak, safeMemory());
  }, 500);
  return {
    stop: () => {
      clearInterval(timer);
      return Math.max(peak, safeMemory());
    },
  };
}

function safeMemory(): number {
  try {
    return TazalaScanner.getMemoryUsage();
  } catch {
    return 0;
  }
}
