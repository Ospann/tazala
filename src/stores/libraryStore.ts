import { create } from 'zustand';

import { BLUR_THRESHOLD } from '@/config';
import { getAnalysisCounts, type AnalysisCounts } from '@/db/analysisRepository';
import { getLibraryTotals, type LibraryTotals } from '@/db/assetsRepository';
import {
  getCategorySummaries,
  type CategoryKind,
  type CategorySummary,
} from '@/db/categoriesRepository';
import { getDatabase } from '@/db/database';
import { readAll } from '@/db/keyValueRepository';
import { getTrashTotals } from '@/db/trashRepository';

import { useSettingsStore } from './settingsStore';

interface LibraryState {
  loaded: boolean;
  totals: LibraryTotals;
  analysis: AnalysisCounts;
  categories: Record<CategoryKind, CategorySummary> | null;
  trash: { count: number; bytes: number };
  freedBytes: number;
  deletedCount: number;
  lastScanAt: number | null;
  revision: number;
  refresh: () => Promise<void>;
}

export function currentThresholds() {
  return {
    blurThreshold: BLUR_THRESHOLD,
    largeVideoBytes: useSettingsStore.getState().largeVideoMb * 1024 * 1024,
  };
}

let refreshing: Promise<void> | null = null;
let refreshQueued = false;

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  loaded: false,
  totals: { photoCount: 0, videoCount: 0, totalBytes: 0 },
  analysis: { analyzed: 0, cloudOnly: 0, failed: 0 },
  categories: null,
  trash: { count: 0, bytes: 0 },
  freedBytes: 0,
  deletedCount: 0,
  lastScanAt: null,
  revision: 0,
  refresh: async () => {
    if (refreshing) {
      refreshQueued = true;
      return refreshing;
    }
    refreshing = (async () => {
      do {
        refreshQueued = false;
        const db = await getDatabase();
        const [totals, analysis, categories, trash, stats] = await Promise.all([
          getLibraryTotals(db),
          getAnalysisCounts(db),
          getCategorySummaries(db, currentThresholds()),
          getTrashTotals(db),
          readAll(db, 'stats'),
        ]);
        set({
          loaded: true,
          totals,
          analysis,
          categories,
          trash,
          freedBytes: Number(stats.freedBytes ?? 0),
          deletedCount: Number(stats.deletedCount ?? 0),
          lastScanAt: stats.lastScanAt ? Number(stats.lastScanAt) : null,
          revision: get().revision + 1,
        });
      } while (refreshQueued);
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  },
}));
