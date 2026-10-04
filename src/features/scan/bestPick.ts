export interface BestPickCandidate {
  id: string;
  isFavorite: boolean;
  blurScore: number;
  width: number;
  height: number;
  createdAt: number;
}

export function compareCandidates(a: BestPickCandidate, b: BestPickCandidate): number {
  if (a.isFavorite !== b.isFavorite) {
    return a.isFavorite ? -1 : 1;
  }
  if (a.blurScore !== b.blurScore) {
    return b.blurScore - a.blurScore;
  }
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  if (areaA !== areaB) {
    return areaB - areaA;
  }
  if (a.createdAt !== b.createdAt) {
    return b.createdAt - a.createdAt;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function pickBest(candidates: readonly BestPickCandidate[]): BestPickCandidate | undefined {
  let best: BestPickCandidate | undefined;
  for (const candidate of candidates) {
    if (!best || compareCandidates(candidate, best) < 0) {
      best = candidate;
    }
  }
  return best;
}
