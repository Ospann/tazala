import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  bytesParts,
  formatBytes,
  formatDate,
  formatDuration,
  formatMonth,
  formatNumber,
} from './format';

export function useFormat() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  return useMemo(
    () => ({
      language,
      bytes: (value: number) => formatBytes(value, language),
      bytesParts: (value: number) => bytesParts(value, language),
      number: (value: number) => formatNumber(value, language),
      date: (timestamp: number) => formatDate(timestamp, language),
      month: (month: string) => formatMonth(month, language),
      duration: formatDuration,
    }),
    [language],
  );
}
