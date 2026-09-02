import { tapOne } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { defaultRng, randInt, sample, type Rng } from '../util/random';
import type { Game, GameResult, Pace, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 6, answerMs: 12000, showMs: 1400 },
  steady: { rounds: 8, answerMs: 9000, showMs: 900 },
  brisk: { rounds: 10, answerMs: 7000, showMs: 600 },
};

export function cupsForPace(pace: Pace): number {
  return pace === 'brisk' ? 4 : 3;
}

export function swapsForRound(round: number, pace: Pace): number {
  const base = pace === 'gentle' ? 1 : 2;
  return Math.min(base + Math.floor(round / 3), 5);
}

/**
 * A list of slot pairs to swap. Both slots in a pair are always different —
 * a pair like [2, 2] would be a swap the player sees nothing happen for.
 */
export function planSwaps(cups: number, count: number, rng: Rng = defaultRng): [number, number][] {
  const slots = Array.from({ length: cups }, (_, index) => index);
  return Array.from({ length: count }, () => sample(slots, 2, rng) as [number, number]);
}

/** Move the two cups currently sitting in slots `a` and `b` into each other's slot. */
export function swapSlots(slotOfCup: readonly number[], a: number, b: number): number[] {
  return slotOfCup.map((slot) => (slot === a ? b : slot === b ? a : slot));
}

/** Where every cup ends up after the whole shuffle. Index is the cup, value is its slot. */
export function runShuffle(cups: number, swaps: readonly [number, number][]): number[] {
  let slots = Array.from({ length: cups }, (_, index) => index);
  for (const [a, b] of swaps) slots = swapSlots(slots, a, b);
  return slots;
}

export const followTheCup: Game = {
  id: 'follow-the-cup',
  name: 'Follow the Cup',
  category: 'Attention',
  blurb: 'Keep your eye on the cup hiding the ball.',
  icon: '🥤',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    const cups = cupsForPace(opts.pace);
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Watch which cup hides the ball.',
      async playRound(view, round) {
        // The ball stays under its cup for the whole round, so being right is
        // simply "did they tap that cup" — no position bookkeeping to get wrong.
        const ballCup = randInt(0, cups - 1);
        const swaps = planSwaps(cups, swapsForRound(round, opts.pace));

        const nodes = Array.from({ length: cups }, (_, cup) => {
          const node = el('button', { className: 'cup', text: '🥤', label: `cup ${cup + 1}` });
          node.type = 'button';
          node.style.width = `${100 / cups}%`;
          return node;
        });
        const row = el('div', { className: 'cup-row', children: nodes });
        view.stage.appendChild(row);

        let slots = Array.from({ length: cups }, (_, index) => index);
        const place = (): void => {
          nodes.forEach((node, cup) => {
            node.style.transform = `translateX(${slots[cup] * 100}%)`;
          });
        };
        place();

        view.prompt('Watch which cup hides the ball.');
        nodes[ballCup].textContent = '🔴';
        await view.wait(view.showMs);
        if (view.signal.aborted) return false;
        nodes[ballCup].textContent = '🥤';

        for (const [a, b] of swaps) {
          if (view.signal.aborted) return false;
          slots = swapSlots(slots, a, b);
          place();
          await view.wait(view.showMs);
        }
        if (view.signal.aborted) return false;

        view.prompt('Which cup is the ball under?');
        const tapped = await tapOne(view, nodes);
        if (tapped !== null) nodes[ballCup].textContent = '🔴';
        return tapped === ballCup;
      },
    });
  },
};
