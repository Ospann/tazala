import type { SQLiteDatabase } from 'expo-sqlite';
import type { AssetInfo } from 'tazala-scanner';

import { insertRows } from './database';

export interface AssetRow {
  id: string;
  uri: string;
  media_type: 'photo' | 'video';
  created_at: number;
  modified_at: number;
  width: number;
  height: number;
  file_size: number;
  file_size_estimated: number;
  duration: number | null;
  is_screenshot: number;
  is_favorite: number;
}

const ASSET_COLUMNS =
  'id, uri, media_type, created_at, modified_at, width, height, file_size, file_size_estimated, duration, is_screenshot, is_favorite, seen_generation';

export async function upsertAssets(
  db: SQLiteDatabase,
  assets: readonly AssetInfo[],
  generation: number,
): Promise<void> {
  const rows = assets.map((asset) => [
    asset.id,
    asset.uri,
    asset.mediaType,
    Math.round(asset.createdAt),
    Math.round(asset.modifiedAt),
    asset.width,
    asset.height,
    Math.round(asset.fileSize),
    asset.fileSizeEstimated ? 1 : 0,
    asset.duration ?? null,
    asset.isScreenshot ? 1 : 0,
    asset.isFavorite ? 1 : 0,
    generation,
  ]);
  await insertRows(
    db,
    `INSERT INTO assets (${ASSET_COLUMNS})`,
    13,
    rows,
    `ON CONFLICT(id) DO UPDATE SET
      uri = excluded.uri,
      media_type = excluded.media_type,
      created_at = excluded.created_at,
      modified_at = excluded.modified_at,
      width = excluded.width,
      height = excluded.height,
      file_size = excluded.file_size,
      file_size_estimated = excluded.file_size_estimated,
      duration = excluded.duration,
      is_screenshot = excluded.is_screenshot,
      is_favorite = excluded.is_favorite,
      seen_generation = excluded.seen_generation`,
  );
}

export async function deleteUnseenAssets(db: SQLiteDatabase, generation: number): Promise<number> {
  const result = await db.runAsync('DELETE FROM assets WHERE seen_generation <> ?', generation);
  return result.changes;
}

export async function deleteAssetsByIds(db: SQLiteDatabase, ids: readonly string[]): Promise<void> {
  for (let start = 0; start < ids.length; start += 500) {
    const chunk = ids.slice(start, start + 500);
    await db.runAsync(`DELETE FROM assets WHERE id IN (${chunk.map(() => '?').join(',')})`, chunk);
  }
}

export interface LibraryTotals {
  photoCount: number;
  videoCount: number;
  totalBytes: number;
}

export async function getLibraryTotals(db: SQLiteDatabase): Promise<LibraryTotals> {
  const row = await db.getFirstAsync<{
    photos: number | null;
    videos: number | null;
    bytes: number | null;
  }>(
    `SELECT
      SUM(CASE WHEN media_type = 'photo' THEN 1 ELSE 0 END) AS photos,
      SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) AS videos,
      SUM(file_size) AS bytes
    FROM assets`,
  );
  return {
    photoCount: row?.photos ?? 0,
    videoCount: row?.videos ?? 0,
    totalBytes: row?.bytes ?? 0,
  };
}
