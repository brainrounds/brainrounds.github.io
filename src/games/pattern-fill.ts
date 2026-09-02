import { tapOne } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { defaultRng, randInt, sample, shuffle, type Rng } from '../util/random';
import { SHAPES } from './palette';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 6, answerMs: 15000, showMs: 0 },
  steady: { rounds: 8, answerMs: 11000, showMs: 0 },
  brisk: { rounds: 10, answerMs: 8000, showMs: 0 },
};

export const SIDE = 3;

export interface Pattern {
  /** Row-major cells; exactly one is null — the gap to fill. */
  cells: (string | null)[];
  answer: string;
  /** The choices offered, in display order. */
  options: string[];
}

/**
 * A three-by-three grid where every row and every column holds each symbol
 * exactly once, with one cell blanked out.
 *
 * That rule is what makes the gap solvable by reasoning rather than guesswork:
 * the missing symbol is the one absent from both its row and its column.
 */
export function makePattern(rng: Rng = defaultRng): Pattern {
  const symbols = sample(SHAPES.map((shape) => shape.glyph), SIDE, rng);
  const shift = randInt(0, SIDE - 1, rng);
  const cells: (string | null)[] = [];
  for (let row = 0; row < SIDE; row++) {
    for (let column = 0; column < SIDE; column++) {
      cells.push(symbols[(row + column + shift) % SIDE]);
    }
  }

  const gap = randInt(0, SIDE * SIDE - 1, rng);
  const answer = cells[gap]!;
  cells[gap] = null;

  return { cells, answer, options: shuffle(symbols, rng) };
}

export const patternFill: Game = {
  id: 'pattern-fill',
  name: 'Pattern Fill',
  category: 'Problem Solving',
  blurb: 'Work out which shape belongs in the empty square.',
  icon: '🧩',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Which shape belongs in the empty square?',
      async playRound(view) {
        const pattern = makePattern();

        const cells = pattern.cells.map((symbol) =>
          el('div', {
            className: `tile shape-tile${symbol === null ? ' is-gap' : ''}`,
            text: symbol ?? '?',
            label: symbol === null ? 'the empty square' : symbol,
          }),
        );
        view.stage.appendChild(el('div', { className: 'grid grid-3 pattern', children: cells }));

        const choices = pattern.options.map((symbol) => {
          const node = el('button', { className: 'choice choice-shape', text: symbol });
          node.type = 'button';
          return node;
        });
        view.stage.appendChild(el('div', { className: 'choice-row', children: choices }));

        const tapped = await tapOne(view, choices);
        return tapped !== null && pattern.options[tapped] === pattern.answer;
      },
    });
  },
};
