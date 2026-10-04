import i18next from 'i18next';

import en from '@/i18n/en.json';
import kk from '@/i18n/kk.json';
import ru from '@/i18n/ru.json';
import { bytesParts, formatDuration, formatMonth } from '@/utils/format';

beforeAll(async () => {
  await i18next.init({
    lng: 'en',
    resources: { en: { translation: en }, ru: { translation: ru }, kk: { translation: kk } },
  });
});

describe('format', () => {
  it('formats bytes with localized units', () => {
    expect(bytesParts(1536 * 1024 * 1024, 'en')).toEqual({ value: '1.5', unit: 'GB' });
    expect(bytesParts(0, 'en')).toEqual({ value: '0', unit: 'B' });
    expect(bytesParts(250 * 1024 * 1024, 'ru').unit).toBe('МБ');
    expect(bytesParts(250 * 1024 * 1024, 'kk').unit).toBe('МБ');
  });

  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('capitalizes month names', () => {
    expect(formatMonth('2024-03', 'en')).toBe('March 2024');
    expect(formatMonth('bad', 'en')).toBe('bad');
  });
});

type Tree = { [key: string]: string | string[] | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    if (key.startsWith('_')) return [];
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' || Array.isArray(value)
      ? [path.replace(/_(one|few|many|other)$/, '')]
      : keys(value, path);
  });
}

describe('translations', () => {
  const english = new Set(keys(en as Tree));

  it.each([
    ['ru', ru],
    ['kk', kk],
  ])('%s has the same keys as English', (_, tree) => {
    expect(new Set(keys(tree as Tree))).toEqual(english);
  });
});
