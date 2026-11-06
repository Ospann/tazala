import { create } from 'zustand';

export type ScanPhase = 'idle' | 'syncing' | 'analyzing' | 'grouping';

export interface ScanMetrics {
  startedAt: number;
  syncMs: number;
  listedAssets: number;
  analyzeMs: number;
  analyzedAssets: number;
  groupingMs: number;
  comparisons: number;
  similarGroups: number;
  duplicateGroups: number;
  peakMemoryBytes: number;
  totalMs: number;
  cancelled: boolean;
}

interface ScanState {
  phase: ScanPhase;
  processed: number;
  total: number;
  paused: boolean;
  error: string | null;
  lastMetrics: ScanMetrics | null;
  set: (partial: Partial<Omit<ScanState, 'set'>>) => void;
}

export const useScanStore = create<ScanState>()((set) => ({
  phase: 'idle',
  processed: 0,
  total: 0,
  paused: false,
  error: null,
  lastMetrics: null,
  set: (partial) => set(partial),
}));
