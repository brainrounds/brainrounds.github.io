import { tapMany } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { defaultRng, randInt, type Rng } from '../util/random';
import { COLOURS } from './palette';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export const TILE_COUNT = 4;

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 6, answerMs: 12000, showMs: 900 },
  steady: { rounds: 8, answerMs: 9000, showMs: 650 },
  brisk: { rounds: 10, answerMs: 7000, showMs: 450 },
};

/** The sequence grows a step at a time, from three, and is capped so it stays fair. */
export function sequenceLengthForRound(round: number): number {
  return Math.min(3 + Math.floor(round / 2), 6);
}

export function makeSequence(length: number, rng: Rng = defaultRng): number[] {
  return Array.from({ length }, () => randInt(0, TILE_COUNT - 1, rng));
}

/** Correct only when the same tiles were tapped in the same order. */
export function orderIsCorrect(target: readonly number[], tapped: readonly number[]): boolean {
  return target.length === tapped.length && target.every((tile, i) => tile === tapped[i]);
}

export const tapOrder: Game = {
  id: 'tap-order',
  name: 'Tap Order',
  category: 'Memory',
  blurb: 'Watch the order the tiles light up, then tap them in that order.',
  icon: '🎵',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Watch the order they light up.',
      async playRound(view, round) {
        const sequence = makeSequence(sequenceLengthForRound(round));

        const tiles = Array.from({ length: TILE_COUNT }, (_, i) => {
          const tile = el('button', {
            className: 'tile tile-lg',
            label: `tile ${i + 1}`,
            style: { borderColor: COLOURS[i % COLOURS.length].hex },
          });
          tile.type = 'button';
          return tile;
        });
        view.stage.appendChild(el('div', { className: 'grid grid-2', children: tiles }));

        view.prompt('Watch the order they light up.');
        for (const index of sequence) {
          if (view.signal.aborted) return false;
          tiles[index].classList.add('is-lit');
          await view.wait(view.showMs);
          tiles[index].classList.remove('is-lit');
          await view.wait(Math.round(view.showMs / 3));
        }
        if (view.signal.aborted) return false;

        view.prompt('Now tap them in the same order.');
        // Repeats are allowed here: 1-3-1 is a perfectly ordinary sequence.
        const tapped = await tapMany(view, tiles, sequence.length, { allowRepeats: true });
        return orderIsCorrect(sequence, tapped);
      },
    });
  },
};
