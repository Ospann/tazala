import type { SQLiteDatabase } from 'expo-sqlite';

import { MEDIA_ITEM_COLUMNS, toMediaItem, type MediaItem, type MediaItemRow } from './mediaItem';

export type SwipeDecision = 'keep' | 'trash';

export interface SwipeMonth {
  month: string;
  total: number;
  reviewed: number;
}

const MONTH_EXPRESSION = "strftime('%Y-%m', a.created_at / 1000, 'unixepoch', 'localtime')";

export async function getSwipeMonths(db: SQLiteDatabase): Promise<SwipeMonth[]> {
  return db.getAllAsync<SwipeMonth>(
    `SELECT ${MONTH_EXPRESSION} AS month,
      COUNT(*) AS total,
      SUM(CASE WHEN d.asset_id IS NOT NULL OR t.asset_id IS NOT NULL THEN 1 ELSE 0 END) AS reviewed
    FROM assets a
    LEFT JOIN swipe_decisions d ON d.asset_id = a.id
    LEFT JOIN trash t ON t.asset_id = a.id
    WHERE a.media_type = 'photo' AND a.created_at > 0
    GROUP BY month
    ORDER BY month DESC`,
  );
}

export async function getSwipeQueue(
  db: SQLiteDatabase,
  month: string | 'random',
): Promise<MediaItem[]> {
  const base = `SELECT ${MEDIA_ITEM_COLUMNS}, NULL AS blur_score
    FROM assets a
    WHERE a.media_type = 'photo'
      AND a.id NOT IN (SELECT asset_id FROM swipe_decisions)
      AND a.id NOT IN (SELECT asset_id FROM trash)`;
  const rows =
    month === 'random'
      ? await db.getAllAsync<MediaItemRow>(`${base} ORDER BY RANDOM() LIMIT 200`)
      : await db.getAllAsync<MediaItemRow>(
          `${base} AND ${MONTH_EXPRESSION} = ? ORDER BY a.created_at, a.id`,
          month,
        );
  return rows.map(toMediaItem);
}

export async function recordDecision(
  db: SQLiteDatabase,
  assetId: string,
  decision: SwipeDecision,
  decidedAt: number,
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO swipe_decisions (asset_id, decision, decided_at) VALUES (?, ?, ?)
      ON CONFLICT(asset_id) DO UPDATE SET decision = excluded.decision, decided_at = excluded.decided_at`,
      assetId,
      decision,
      decidedAt,
    );
    if (decision === 'trash') {
      await txn.runAsync(
        "INSERT OR IGNORE INTO trash (asset_id, added_at, source) VALUES (?, ?, 'swipe')",
        assetId,
        decidedAt,
      );
    }
  });
}

export async function undoDecision(db: SQLiteDatabase, assetId: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM swipe_decisions WHERE asset_id = ?', assetId);
    await txn.runAsync("DELETE FROM trash WHERE asset_id = ? AND source = 'swipe'", assetId);
  });
}

export async function resetSwipeDecisions(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM swipe_decisions');
}
