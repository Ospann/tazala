import { useCallback, useEffect, useState } from 'react';

import {
  getCategoryItems,
  getGroups,
  type CategoryKind,
  type MediaGroup,
} from '@/db/categoriesRepository';
import { getDatabase } from '@/db/database';
import type { MediaItem } from '@/db/mediaItem';
import { currentThresholds, useLibraryStore } from '@/stores/libraryStore';

export type CategoryData =
  | { type: 'groups'; groups: MediaGroup[] }
  | { type: 'items'; items: MediaItem[] };

async function fetchCategoryData(kind: CategoryKind): Promise<CategoryData> {
  const db = await getDatabase();
  if (kind === 'similar' || kind === 'duplicates') {
    return { type: 'groups', groups: await getGroups(db, kind) };
  }
  return { type: 'items', items: await getCategoryItems(db, kind, currentThresholds()) };
}

export function useCategoryData(kind: CategoryKind) {
  const [data, setData] = useState<CategoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const revision = useLibraryStore((state) => state.revision);

  useEffect(() => {
    let active = true;
    fetchCategoryData(kind).then(
      (result) => {
        if (!active) return;
        setData(result);
        setError(null);
      },
      (caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : String(caught));
      },
    );
    return () => {
      active = false;
    };
  }, [kind, revision, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, error, reload };
}
