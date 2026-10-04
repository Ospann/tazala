import type { SQLiteDatabase } from 'expo-sqlite';

import { chunk, insertRows, placeholders } from './database';
import { MEDIA_ITEM_COLUMNS, toMediaItem, type MediaItem, type MediaItemRow } from './mediaItem';

export type TrashSource = 'similar' | 'duplicates' | 'screenshots' | 'blurry' | 'videos' | 'swipe';

export async function addToTrash(
  db: SQLiteDatabase,
  ids: readonly string[],
  source: TrashSource,
  addedAt: number,
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await insertRows(
      txn,
      'INSERT OR IGNORE INTO trash (asset_id, added_at, source)',
      3,
      ids.map((id) => [id, addedAt, source]),
    );
  });
}

export async function removeFromTrash(db: SQLiteDatabase, ids: readonly string[]): Promise<void> {
  for (const part of chunk(ids, 500)) {
    await db.runAsync(`DELETE FROM trash WHERE asset_id IN (${placeholders(part.length)})`, part);
  }
}

export async function restoreFromTrash(db: SQLiteDatabase, ids: readonly string[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const part of chunk(ids, 500)) {
      await txn.runAsync(
        `DELETE FROM trash WHERE asset_id IN (${placeholders(part.length)})`,
        part,
      );
      await txn.runAsync(
        `DELETE FROM swipe_decisions WHERE decision = 'trash' AND asset_id IN (${placeholders(part.length)})`,
        part,
      );
    }
  });
}

export async function clearTrash(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM trash');
}

export async function getTrashItems(db: SQLiteDatabase): Promise<MediaItem[]> {
  const rows = await db.getAllAsync<MediaItemRow>(
    `SELECT ${MEDIA_ITEM_COLUMNS}, NULL AS blur_score
    FROM trash t JOIN assets a ON a.id = t.asset_id
    ORDER BY t.added_at DESC, a.created_at DESC`,
  );
  return rows.map(toMediaItem);
}

export async function getTrashTotals(
  db: SQLiteDatabase,
): Promise<{ count: number; bytes: number }> {
  const row = await db.getFirstAsync<{ count: number | null; bytes: number | null }>(
    'SELECT COUNT(*) AS count, SUM(a.file_size) AS bytes FROM trash t JOIN assets a ON a.id = t.asset_id',
  );
  return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
}

export async function getSizesForIds(db: SQLiteDatabase, ids: readonly string[]): Promise<number> {
  let total = 0;
  for (const part of chunk(ids, 500)) {
    const row = await db.getFirstAsync<{ bytes: number | null }>(
      `SELECT SUM(file_size) AS bytes FROM assets WHERE id IN (${placeholders(part.length)})`,
      part,
    );
    total += row?.bytes ?? 0;
  }
  return total;
}
