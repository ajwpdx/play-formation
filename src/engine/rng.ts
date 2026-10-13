/** mulberry32: tiny seedable PRNG. State is a single uint32 so it fits in GameState. */
export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Fisher-Yates shuffle; returns the shuffled copy and the advanced rng state. */
export function shuffle<T>(items: readonly T[], rng: number): [T[], number] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(rng);
    rng = next;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return [a, rng];
}
