import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { MEDIA_FILTERS, type MediaFilter } from '@/db/media-item';

import type { Segment } from './segmented-control';

export function useMediaFilterSegments(): readonly Segment<MediaFilter>[] {
  const { t } = useTranslation();
  return useMemo(
    () => MEDIA_FILTERS.map((value) => ({ value, label: t(`mediaFilter.${value}`) })),
    [t],
  );
}
