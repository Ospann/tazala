import type { SQLiteDatabase } from 'expo-sqlite';
import type { AssetAnalysis } from 'tazala-scanner';

import { insertRows } from './database';

export interface StaleAsset {
  id: string;
  modified_at: number;
}

export async function getAssetsNeedingAnalysis(
  db: SQLiteDatabase,
  analysisVersion: number,
): Promise<StaleAsset[]> {
  return db.getAllAsync<StaleAsset>(
    `SELECT a.id, a.modified_at
    FROM assets a
    LEFT JOIN analysis an ON an.asset_id = a.id
    WHERE a.media_type = 'photo'
      AND (
        an.asset_id IS NULL
        OR an.analysis_version <> ?
        OR an.analyzed_modified_at <> a.modified_at
        OR an.status <> 'ok'
      )
    ORDER BY a.created_at, a.id`,
    analysisVersion,
  );
}

export async function saveAnalyses(
  db: SQLiteDatabase,
  analyses: readonly AssetAnalysis[],
  modifiedAtById: ReadonlyMap<string, number>,
  analyzedAt: number,
): Promise<void> {
  if (analyses.length === 0) {
    return;
  }
  const rows = analyses.map((analysis) => [
    analysis.id,
    analysis.status,
    analysis.fingerprint,
    analysis.fingerprintKind,
    analysis.exactHash,
    Number.isFinite(analysis.blurScore) ? analysis.blurScore : 0,
    analysis.analysisVersion,
    modifiedAtById.get(analysis.id) ?? 0,
    analyzedAt,
  ]);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(
      `CREATE TEMP TABLE IF NOT EXISTS analysis_incoming (
        asset_id TEXT PRIMARY KEY, status TEXT, fingerprint TEXT, fingerprint_kind TEXT,
        exact_hash TEXT, blur_score REAL, analysis_version INTEGER,
        analyzed_modified_at INTEGER, analyzed_at INTEGER
      );
      DELETE FROM analysis_incoming;`,
    );
    await insertRows(txn, 'INSERT OR REPLACE INTO analysis_incoming', 9, rows);
    await txn.execAsync(
      `INSERT OR REPLACE INTO analysis
        (asset_id, status, fingerprint, fingerprint_kind, exact_hash, blur_score, analysis_version, analyzed_modified_at, analyzed_at)
      SELECT i.asset_id, i.status, i.fingerprint, i.fingerprint_kind, i.exact_hash, i.blur_score,
        i.analysis_version, i.analyzed_modified_at, i.analyzed_at
      FROM analysis_incoming i
      JOIN assets a ON a.id = i.asset_id;
      DELETE FROM analysis_incoming;`,
    );
  });
}

export async function clearAnalysis(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DELETE FROM similar_groups; DELETE FROM analysis;');
}

export interface AnalysisCounts {
  analyzed: number;
  cloudOnly: number;
  failed: number;
}

export async function getAnalysisCounts(db: SQLiteDatabase): Promise<AnalysisCounts> {
  const row = await db.getFirstAsync<{
    analyzed: number | null;
    cloud: number | null;
    failed: number | null;
  }>(
    `SELECT
      SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS analyzed,
      SUM(CASE WHEN status = 'cloud-only' THEN 1 ELSE 0 END) AS cloud,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM analysis`,
  );
  return { analyzed: row?.analyzed ?? 0, cloudOnly: row?.cloud ?? 0, failed: row?.failed ?? 0 };
}
