import type { BestPickCandidate } from '@/features/scan/bestPick';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const { resolveGroups, withoutPureDuplicates } =
  jest.requireActual<typeof import('@/db/groupsRepository')>('@/db/groupsRepository');

function candidate(id: string, blurScore: number): BestPickCandidate {
  return { id, isFavorite: false, blurScore, width: 100, height: 100, createdAt: 0 };
}

describe('withoutPureDuplicates', () => {
  it('drops similar groups that are exactly one duplicate set', () => {
    const similar = [
      ['a', 'b'],
      ['c', 'd', 'e'],
    ];
    const duplicates = [
      ['a', 'b'],
      ['c', 'd'],
    ];
    expect(withoutPureDuplicates(similar, duplicates)).toEqual([['c', 'd', 'e']]);
  });

  it('keeps groups with members outside any duplicate set', () => {
    expect(withoutPureDuplicates([['x', 'y']], [])).toEqual([['x', 'y']]);
  });
});

describe('resolveGroups', () => {
  it('skips missing assets and groups that shrink below two', () => {
    const candidates = new Map([
      ['a', candidate('a', 10)],
      ['b', candidate('b', 50)],
      ['c', candidate('c', 20)],
    ]);
    expect(
      resolveGroups(
        [
          ['a', 'b', 'gone'],
          ['c', 'gone'],
        ],
        candidates,
      ),
    ).toEqual([{ assetIds: ['a', 'b'], bestAssetId: 'b' }]);
  });
});
