/** A source of randomness. Injectable so game logic can be tested deterministically. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** A whole number in [min, max], inclusive at both ends. */
export function randInt(min: number, max: number, rng: Rng = defaultRng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of a non-empty array. */
export function pick<T>(items: readonly T[], rng: Rng = defaultRng): T {
  return items[randInt(0, items.length - 1, rng)];
}

/** A new array with the items in a random order. Does not mutate the input. */
export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(0, i, rng);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `count` distinct items drawn from `items`. Throws if there are not enough. */
export function sample<T>(items: readonly T[], count: number, rng: Rng = defaultRng): T[] {
  if (count > items.length) {
    throw new Error(`cannot sample ${count} from ${items.length} items`);
  }
  return shuffle(items, rng).slice(0, count);
}

/** `count` distinct whole numbers from 0 to `size - 1`. */
export function sampleIndexes(size: number, count: number, rng: Rng = defaultRng): number[] {
  const all = Array.from({ length: size }, (_, i) => i);
  return sample(all, count, rng);
}

/** True with probability `p`. */
export function chance(p: number, rng: Rng = defaultRng): boolean {
  return rng() < p;
}

/**
 * A deterministic Rng for tests and for any place a reproducible sequence is
 * wanted. Small, fast, and good enough for shuffling shapes on a screen.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}
