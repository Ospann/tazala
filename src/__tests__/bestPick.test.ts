import { compareCandidates, pickBest, type BestPickCandidate } from '@/features/scan/bestPick';

const base: BestPickCandidate = {
  id: 'a',
  isFavorite: false,
  blurScore: 100,
  width: 4000,
  height: 3000,
  createdAt: 1000,
};

describe('pickBest', () => {
  it('prefers favorites over everything else', () => {
    const favorite = { ...base, id: 'fav', isFavorite: true, blurScore: 1, width: 10, height: 10 };
    expect(pickBest([base, favorite])?.id).toBe('fav');
  });

  it('prefers the sharpest photo when none is favorite', () => {
    const sharp = { ...base, id: 'sharp', blurScore: 500 };
    expect(pickBest([base, sharp])?.id).toBe('sharp');
  });

  it('breaks ties by resolution and then by newest', () => {
    const larger = { ...base, id: 'large', width: 5000 };
    const newer = { ...base, id: 'newer', createdAt: 2000 };
    expect(pickBest([base, larger])?.id).toBe('large');
    expect(pickBest([base, newer])?.id).toBe('newer');
  });

  it('is deterministic for identical candidates', () => {
    const twin = { ...base, id: 'b' };
    expect(compareCandidates(base, twin)).toBeLessThan(0);
    expect(pickBest([twin, base])?.id).toBe('a');
  });

  it('returns undefined for an empty list', () => {
    expect(pickBest([])).toBeUndefined();
  });
});
