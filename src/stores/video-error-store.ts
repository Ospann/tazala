import { create } from 'zustand';

export type VideoErrorStage = 'resolve' | 'load' | 'player' | 'first-frame' | 'export';

export interface VideoErrorEntry {
  assetId: string;
  stage: VideoErrorStage;
  attempt: number;
  message: string;
  source: string | null;
  at: number;
}

interface VideoErrorState {
  entries: VideoErrorEntry[];
  record: (entry: Omit<VideoErrorEntry, 'at'>) => void;
  clear: () => void;
}

const LIMIT = 20;

export function describeSource(uri: string | null): string | null {
  if (!uri) return null;
  const match = /^([a-z]+):\/\/(\/[^/]+\/[^/]+)?/i.exec(uri);
  return match ? `${match[1]}:${match[2] ?? ''}` : 'unknown';
}

export const useVideoErrorStore = create<VideoErrorState>()((set) => ({
  entries: [],
  record: (entry) =>
    set((state) => ({ entries: [{ ...entry, at: Date.now() }, ...state.entries].slice(0, LIMIT) })),
  clear: () => set({ entries: [] }),
}));
