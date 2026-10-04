import { t } from 'i18next';

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export interface BytesParts {
  value: string;
  unit: string;
}

export function bytesParts(bytes: number, language: string): BytesParts {
  const safe = Math.max(bytes, 0);
  const [divisor, unitKey, digits] =
    safe >= GB
      ? [GB, 'units.gb', safe >= 100 * GB ? 0 : 1]
      : safe >= MB
        ? [MB, 'units.mb', safe >= 100 * MB ? 0 : 1]
        : safe >= KB
          ? [KB, 'units.kb', 0]
          : [1, 'units.b', 0];
  const value = new Intl.NumberFormat(language, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(safe / divisor);
  return { value, unit: t(unitKey, { lng: language }) };
}

export function formatBytes(bytes: number, language: string): string {
  const { value, unit } = bytesParts(bytes, language);
  return `${value} ${unit}`;
}

export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value);
}

export function formatDate(timestamp: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function formatMonth(month: string, language: string): string {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return month;
  }
  const name = new Intl.DateTimeFormat(language, { month: 'long' }).format(
    new Date(year, monthIndex, 1),
  );
  return `${name.charAt(0).toLocaleUpperCase(language)}${name.slice(1)} ${year}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDuration(seconds: number): string {
  const total = Math.max(Math.round(seconds), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
