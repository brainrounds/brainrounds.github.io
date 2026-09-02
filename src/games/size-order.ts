import { tapMany } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { defaultRng, pick, sample, type Rng } from '../util/random';
import { COLOURS } from './palette';
import type { Game, GameResult, Pace, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 6, answerMs: 15000, showMs: 0 },
  steady: { rounds: 8, answerMs: 11000, showMs: 0 },
  brisk: { rounds: 10, answerMs: 8000, showMs: 0 },
};

/** Sizes are spaced far enough apart to be told apart at a glance. */
const SIZE_STEPS = [44, 66, 88, 110, 132, 154];

export function itemCountForPace(pace: Pace): number {
  return pace === 'gentle' ? 3 : pace === 'steady' ? 4 : 5;
}

/** Distinct sizes in a random display order. */
export function makeSizes(count: number, rng: Rng = defaultRng): number[] {
  return sample(SIZE_STEPS, count, rng);
}

/** The indexes of `sizes`, ordered smallest to largest. */
export function ascendingOrder(sizes: readonly number[]): number[] {
  return sizes
    .map((size, index) => ({ size, index }))
    .sort((a, b) => a.size - b.size)
    .map((entry) => entry.index);
}

/** Correct only when every circle was tapped, smallest first. */
export function orderIsCorrect(sizes: readonly number[], tapped: readonly number[]): boolean {
  const expected = ascendingOrder(sizes);
  return tapped.length === expected.length && tapped.every((index, i) => index === expected[i]);
}

export const sizeOrder: Game = {
  id: 'size-order',
  name: 'Size Order',
  category: 'Problem Solving',
  blurb: 'Tap the circles from smallest to largest.',
  icon: '📏',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    const count = itemCountForPace(opts.pace);
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Tap the circles from smallest to largest.',
      async playRound(view) {
        const sizes = makeSizes(count);
        const colour = pick(COLOURS);

        const nodes = sizes.map((size, index) => {
          const node = el('button', {
            className: 'blob',
            label: `circle ${index + 1}`,
            style: {
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: colour.hex,
            },
          });
          node.type = 'button';
          return node;
        });
        view.stage.appendChild(el('div', { className: 'blob-row', children: nodes }));

        const tapped = await tapMany(view, nodes, count);
        return orderIsCorrect(sizes, tapped);
      },
    });
  },
};
