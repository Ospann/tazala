import type { SQLiteDatabase } from 'expo-sqlite';

type KeyValueTable = 'stats' | 'settings';

export async function readAll(
  db: SQLiteDatabase,
  table: KeyValueTable,
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM ${table}`,
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function writeValue(
  db: SQLiteDatabase,
  table: KeyValueTable,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO ${table} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function incrementStat(
  db: SQLiteDatabase,
  key: string,
  delta: number,
): Promise<number> {
  await db.runAsync(
    `INSERT INTO stats (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS REAL) + ? AS TEXT)`,
    key,
    String(delta),
    delta,
  );
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM stats WHERE key = ?',
    key,
  );
  return Number(row?.value ?? 0);
}
