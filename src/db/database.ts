import { openDatabaseAsync, type SQLiteBindValue, type SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';

const DATABASE_NAME = 'tazala.db';
const MAX_BIND_PARAMETERS = 900;

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndMigrate().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;',
  );
  await migrate(db);
  return db;
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const statement of migration.statements) {
        await txn.execAsync(statement);
      }
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

export async function insertRows(
  db: Pick<SQLiteDatabase, 'runAsync'>,
  prefix: string,
  columnCount: number,
  rows: SQLiteBindValue[][],
  suffix = '',
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const rowsPerStatement = Math.max(1, Math.floor(MAX_BIND_PARAMETERS / columnCount));
  const placeholder = `(${placeholders(columnCount)})`;
  for (let start = 0; start < rows.length; start += rowsPerStatement) {
    const slice = rows.slice(start, start + rowsPerStatement);
    const sql = `${prefix} VALUES ${slice.map(() => placeholder).join(',')} ${suffix}`;
    await db.runAsync(sql, slice.flat());
  }
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}
