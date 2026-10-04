import type { SQLiteDatabase } from 'expo-sqlite';

import type { GroupKind } from './groupsRepository';
import { MEDIA_ITEM_COLUMNS, toMediaItem, type MediaItem, type MediaItemRow } from './mediaItem';

export type CategoryKind = 'similar' | 'duplicates' | 'screenshots' | 'blurry' | 'videos';

export interface CategoryThresholds {
  blurThreshold: number;
  largeVideoBytes: number;
}

export interface CategorySummary {
  kind: CategoryKind;
  count: number;
  groupCount: number;
  bytes: number;
}

const NOT_IN_TRASH = 'a.id NOT IN (SELECT asset_id FROM trash)';

function groupKindFor(kind: 'similar' | 'duplicates'): GroupKind {
  return kind === 'similar' ? 'similar' : 'duplicate';
}

async function groupSummary(
  db: SQLiteDatabase,
  kind: 'similar' | 'duplicates',
): Promise<CategorySummary> {
  const row = await db.getFirstAsync<{
    groups: number | null;
    items: number | null;
    bytes: number | null;
  }>(
    `WITH members AS (
      SELECT g.group_id, g.is_best, a.file_size
      FROM similar_groups g JOIN assets a ON a.id = g.asset_id
      WHERE g.kind = ? AND ${NOT_IN_TRASH}
    ),
    valid AS (SELECT group_id FROM members GROUP BY group_id HAVING COUNT(*) > 1)
    SELECT COUNT(DISTINCT m.group_id) AS groups,
      SUM(CASE WHEN m.is_best = 0 THEN 1 ELSE 0 END) AS items,
      SUM(CASE WHEN m.is_best = 0 THEN m.file_size ELSE 0 END) AS bytes
    FROM members m WHERE m.group_id IN (SELECT group_id FROM valid)`,
    groupKindFor(kind),
  );
  return { kind, groupCount: row?.groups ?? 0, count: row?.items ?? 0, bytes: row?.bytes ?? 0 };
}

function listCondition(kind: 'screenshots' | 'blurry' | 'videos'): string {
  switch (kind) {
    case 'screenshots':
      return "a.media_type = 'photo' AND a.is_screenshot = 1";
    case 'blurry':
      return "a.media_type = 'photo' AND a.is_screenshot = 0 AND an.status = 'ok' AND an.blur_score < ?";
    case 'videos':
      return "a.media_type = 'video' AND a.file_size >= ?";
  }
}

function listParams(
  kind: 'screenshots' | 'blurry' | 'videos',
  thresholds: CategoryThresholds,
): number[] {
  switch (kind) {
    case 'screenshots':
      return [];
    case 'blurry':
      return [thresholds.blurThreshold];
    case 'videos':
      return [thresholds.largeVideoBytes];
  }
}

function listOrder(kind: 'screenshots' | 'blurry' | 'videos'): string {
  switch (kind) {
    case 'screenshots':
      return 'a.created_at DESC';
    case 'blurry':
      return 'an.blur_score ASC';
    case 'videos':
      return 'a.file_size DESC';
  }
}

async function listSummary(
  db: SQLiteDatabase,
  kind: 'screenshots' | 'blurry' | 'videos',
  thresholds: CategoryThresholds,
): Promise<CategorySummary> {
  const row = await db.getFirstAsync<{ items: number | null; bytes: number | null }>(
    `SELECT COUNT(*) AS items, SUM(a.file_size) AS bytes
    FROM assets a LEFT JOIN analysis an ON an.asset_id = a.id
    WHERE ${listCondition(kind)} AND ${NOT_IN_TRASH}`,
    listParams(kind, thresholds),
  );
  return { kind, count: row?.items ?? 0, groupCount: 0, bytes: row?.bytes ?? 0 };
}

export async function getCategorySummaries(
  db: SQLiteDatabase,
  thresholds: CategoryThresholds,
): Promise<Record<CategoryKind, CategorySummary>> {
  const [similar, duplicates, screenshots, blurry, videos] = await Promise.all([
    groupSummary(db, 'similar'),
    groupSummary(db, 'duplicates'),
    listSummary(db, 'screenshots', thresholds),
    listSummary(db, 'blurry', thresholds),
    listSummary(db, 'videos', thresholds),
  ]);
  return { similar, duplicates, screenshots, blurry, videos };
}

export async function getCategoryItems(
  db: SQLiteDatabase,
  kind: 'screenshots' | 'blurry' | 'videos',
  thresholds: CategoryThresholds,
): Promise<MediaItem[]> {
  const rows = await db.getAllAsync<MediaItemRow>(
    `SELECT ${MEDIA_ITEM_COLUMNS}, an.blur_score
    FROM assets a LEFT JOIN analysis an ON an.asset_id = a.id
    WHERE ${listCondition(kind)} AND ${NOT_IN_TRASH}
    ORDER BY ${listOrder(kind)}`,
    listParams(kind, thresholds),
  );
  return rows.map(toMediaItem);
}

export interface MediaGroup {
  groupId: number;
  bestAssetId: string;
  items: MediaItem[];
}

export async function getGroups(
  db: SQLiteDatabase,
  kind: 'similar' | 'duplicates',
): Promise<MediaGroup[]> {
  const rows = await db.getAllAsync<MediaItemRow & { group_id: number; is_best: number }>(
    `SELECT g.group_id, g.is_best, ${MEDIA_ITEM_COLUMNS}, an.blur_score
    FROM similar_groups g
    JOIN assets a ON a.id = g.asset_id
    LEFT JOIN analysis an ON an.asset_id = a.id
    WHERE g.kind = ? AND ${NOT_IN_TRASH}
    ORDER BY g.group_id, a.created_at`,
    groupKindFor(kind),
  );
  const groups = new Map<number, MediaGroup>();
  for (const row of rows) {
    let group = groups.get(row.group_id);
    if (!group) {
      group = { groupId: row.group_id, bestAssetId: '', items: [] };
      groups.set(row.group_id, group);
    }
    group.items.push(toMediaItem(row));
    if (row.is_best === 1) group.bestAssetId = row.id;
  }
  return [...groups.values()]
    .filter((group) => group.items.length > 1)
    .map((group) => ({
      ...group,
      bestAssetId: group.bestAssetId || (group.items[group.items.length - 1]?.id ?? ''),
    }))
    .sort((a, b) => (b.items[0]?.createdAt ?? 0) - (a.items[0]?.createdAt ?? 0));
}
