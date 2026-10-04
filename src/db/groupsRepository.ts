import type { SQLiteDatabase } from 'expo-sqlite';

import { pickBest, type BestPickCandidate } from '@/features/scan/bestPick';

import { insertRows } from './database';

export type GroupKind = 'similar' | 'duplicate';

interface CandidateRow {
  id: string;
  is_favorite: number;
  blur_score: number | null;
  width: number;
  height: number;
  created_at: number;
}

export interface ResolvedGroup {
  assetIds: string[];
  bestAssetId: string;
}

async function loadCandidates(db: SQLiteDatabase): Promise<Map<string, CandidateRow>> {
  const rows = await db.getAllAsync<CandidateRow>(
    `SELECT a.id, a.is_favorite, an.blur_score, a.width, a.height, a.created_at
    FROM assets a JOIN analysis an ON an.asset_id = a.id
    WHERE a.media_type = 'photo' AND an.status = 'ok'`,
  );
  return new Map(rows.map((row) => [row.id, row]));
}

function toCandidate(row: CandidateRow): BestPickCandidate {
  return {
    id: row.id,
    isFavorite: row.is_favorite === 1,
    blurScore: row.blur_score ?? 0,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export function resolveGroups(
  groups: readonly (readonly string[])[],
  candidates: ReadonlyMap<string, BestPickCandidate>,
): ResolvedGroup[] {
  const resolved: ResolvedGroup[] = [];
  for (const group of groups) {
    const members = group
      .map((id) => candidates.get(id))
      .filter((candidate): candidate is BestPickCandidate => candidate !== undefined);
    if (members.length < 2) continue;
    const best = pickBest(members);
    if (!best) continue;
    resolved.push({ assetIds: members.map((member) => member.id), bestAssetId: best.id });
  }
  return resolved;
}

export function withoutPureDuplicates(
  similar: readonly (readonly string[])[],
  duplicates: readonly (readonly string[])[],
): (readonly string[])[] {
  const duplicateGroupOf = new Map<string, number>();
  duplicates.forEach((group, index) => {
    for (const id of group) duplicateGroupOf.set(id, index);
  });
  return similar.filter((group) => {
    const first = duplicateGroupOf.get(group[0] ?? '');
    return first === undefined || group.some((id) => duplicateGroupOf.get(id) !== first);
  });
}

export async function replaceGroups(
  db: SQLiteDatabase,
  similar: readonly (readonly string[])[],
  duplicates: readonly (readonly string[])[],
): Promise<{ similar: number; duplicates: number }> {
  const rows = await loadCandidates(db);
  const candidates = new Map([...rows].map(([id, row]) => [id, toCandidate(row)]));
  const resolvedSimilar = resolveGroups(withoutPureDuplicates(similar, duplicates), candidates);
  const resolvedDuplicates = resolveGroups(duplicates, candidates);
  const insert: (string | number)[][] = [];
  resolvedSimilar.forEach((group, index) => {
    for (const id of group.assetIds)
      insert.push([index, 'similar', id, id === group.bestAssetId ? 1 : 0]);
  });
  resolvedDuplicates.forEach((group, index) => {
    for (const id of group.assetIds)
      insert.push([index, 'duplicate', id, id === group.bestAssetId ? 1 : 0]);
  });
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM similar_groups');
    await insertRows(
      txn,
      'INSERT OR IGNORE INTO similar_groups (group_id, kind, asset_id, is_best)',
      4,
      insert,
    );
  });
  return { similar: resolvedSimilar.length, duplicates: resolvedDuplicates.length };
}
