import { tapMany } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { defaultRng, sampleIndexes, type Rng } from '../util/random';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export const GRID_SIZE = 4;
const CELLS = GRID_SIZE * GRID_SIZE;

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 6, answerMs: 12000, showMs: 2600 },
  steady: { rounds: 8, answerMs: 9000, showMs: 1800 },
  brisk: { rounds: 10, answerMs: 7000, showMs: 1200 },
};

/** How many tiles light up, growing gently as the game goes on. */
export function tileCountForRound(round: number, pace: keyof PaceTable): number {
  const start = pace === 'gentle' ? 2 : 3;
  return Math.min(start + Math.floor(round / 3), 6);
}

export function pickTiles(count: number, rng: Rng = defaultRng): number[] {
  return sampleIndexes(CELLS, count, rng);
}

/** Correct when the same set of tiles was tapped, in any order. */
export function recallIsCorrect(target: readonly number[], tapped: readonly number[]): boolean {
  if (tapped.length !== target.length) return false;
  const wanted = new Set(target);
  return tapped.every((index) => wanted.has(index));
}

export const gridRecall: Game = {
  id: 'grid-recall',
  name: 'Grid Recall',
  category: 'Memory',
  blurb: 'Remember which squares light up, then tap them.',
  icon: '🔲',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Watch which squares light up.',
      async playRound(view, round) {
        const count = tileCountForRound(round, opts.pace);
        const target = pickTiles(count);

        const tiles = Array.from({ length: CELLS }, () => {
          const tile = el('button', { className: 'tile' });
          tile.type = 'button';
          return tile;
        });
        view.stage.appendChild(el('div', { className: 'grid grid-4', children: tiles }));

        view.prompt('Watch which squares light up.');
        target.forEach((index) => tiles[index].classList.add('is-lit'));
        await view.wait(view.showMs);
        if (view.signal.aborted) return false;
        target.forEach((index) => tiles[index].classList.remove('is-lit'));

        view.prompt(`Now tap those ${count} squares.`);
        const tapped = await tapMany(view, tiles, count);
        return recallIsCorrect(target, tapped);
      },
    });
  },
};
