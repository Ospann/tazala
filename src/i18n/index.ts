import { getLocales } from 'expo-localization';
import i18next, { changeLanguage } from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { LanguagePreference } from '@/stores/settingsStore';

import en from './en.json';
import kk from './kk.json';
import ru from './ru.json';

export const supportedLanguages = ['ru', 'kk', 'en'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export function resolveLanguage(preference: LanguagePreference): SupportedLanguage {
  if (preference !== 'system') {
    return preference;
  }
  for (const locale of getLocales()) {
    const code = locale.languageCode;
    const match = supportedLanguages.find((language) => language === code);
    if (match) {
      return match;
    }
  }
  return 'en';
}

export function initI18n(preference: LanguagePreference): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources: { en: { translation: en }, ru: { translation: ru }, kk: { translation: kk } },
      lng: resolveLanguage(preference),
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18next;
}

export async function applyLanguage(preference: LanguagePreference): Promise<void> {
  const language = resolveLanguage(preference);
  if (i18next.language !== language) {
    await changeLanguage(language);
  }
}

export default i18next;
