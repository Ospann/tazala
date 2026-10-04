import { Platform } from 'react-native';
import TazalaScanner from 'tazala-scanner';

import { deleteAssetsByIds } from '@/db/assetsRepository';
import { chunk, getDatabase } from '@/db/database';
import { incrementStat } from '@/db/keyValueRepository';
import { getSizesForIds } from '@/db/trashRepository';
import { useLibraryStore } from '@/stores/libraryStore';

export interface DeleteOutcome {
  deletedCount: number;
  freedBytes: number;
  failedCount: number;
  cancelled: boolean;
}

const CHUNK_SIZE = Platform.OS === 'ios' ? 10000 : 1000;

export async function deleteFromLibrary(ids: readonly string[]): Promise<DeleteOutcome> {
  const db = await getDatabase();
  const outcome: DeleteOutcome = {
    deletedCount: 0,
    freedBytes: 0,
    failedCount: 0,
    cancelled: false,
  };
  const parts = chunk(ids, CHUNK_SIZE);
  try {
    for (const [index, part] of parts.entries()) {
      const result = await TazalaScanner.deleteAssets(part);
      if (result.deletedIds.length > 0) {
        const bytes = await getSizesForIds(db, result.deletedIds);
        await deleteAssetsByIds(db, result.deletedIds);
        outcome.deletedCount += result.deletedIds.length;
        outcome.freedBytes += bytes;
        await incrementStat(db, 'freedBytes', bytes);
        await incrementStat(db, 'deletedCount', result.deletedIds.length);
      }
      if (result.missingIds.length > 0) {
        await deleteAssetsByIds(db, result.missingIds);
      }
      outcome.failedCount += result.failedIds.length;
      if (result.cancelled) {
        outcome.cancelled = true;
        outcome.failedCount += parts.slice(index + 1).reduce((sum, rest) => sum + rest.length, 0);
        break;
      }
    }
  } finally {
    await useLibraryStore.getState().refresh();
  }
  return outcome;
}
