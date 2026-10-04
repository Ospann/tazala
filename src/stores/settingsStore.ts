import type { SimilarityLevel } from 'tazala-scanner';
import { create } from 'zustand';

import { DEFAULT_LARGE_VIDEO_MB, LARGE_VIDEO_OPTIONS_MB } from '@/config';
import { getDatabase } from '@/db/database';
import { readAll, writeValue } from '@/db/keyValueRepository';

export type LanguagePreference = 'system' | 'ru' | 'kk' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';
export type LargeVideoMb = (typeof LARGE_VIDEO_OPTIONS_MB)[number];

export interface Settings {
  language: LanguagePreference;
  theme: ThemePreference;
  similarityLevel: SimilarityLevel;
  largeVideoMb: LargeVideoMb;
  onboardingCompleted: boolean;
}

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export const defaultSettings: Settings = {
  language: 'system',
  theme: 'system',
  similarityLevel: 'medium',
  largeVideoMb: DEFAULT_LARGE_VIDEO_MB,
  onboardingCompleted: false,
};

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => String(item) === value) ?? fallback;
}

export function parseSettings(raw: Record<string, string>): Settings {
  return {
    language: oneOf(raw.language, ['system', 'ru', 'kk', 'en'] as const, defaultSettings.language),
    theme: oneOf(raw.theme, ['system', 'light', 'dark'] as const, defaultSettings.theme),
    similarityLevel: oneOf(
      raw.similarityLevel,
      ['low', 'medium', 'high'] as const,
      defaultSettings.similarityLevel,
    ),
    largeVideoMb: oneOf(raw.largeVideoMb, LARGE_VIDEO_OPTIONS_MB, defaultSettings.largeVideoMb),
    onboardingCompleted: raw.onboardingCompleted === 'true',
  };
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...defaultSettings,
  loaded: false,
  load: async () => {
    const db = await getDatabase();
    const raw = await readAll(db, 'settings');
    set({ ...parseSettings(raw), loaded: true });
  },
  update: async (key, value) => {
    set({ [key]: value } as Pick<Settings, typeof key>);
    const db = await getDatabase();
    await writeValue(db, 'settings', key, String(value));
  },
}));
