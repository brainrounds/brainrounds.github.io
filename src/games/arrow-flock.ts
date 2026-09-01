import { askButtons } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { chance, defaultRng, pick, type Rng } from '../util/random';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 8, answerMs: 7000, showMs: 0 },
  steady: { rounds: 12, answerMs: 4500, showMs: 0 },
  brisk: { rounds: 16, answerMs: 3000, showMs: 0 },
};

export const FLOCK_SIZE = 5;
export const CENTRE = Math.floor(FLOCK_SIZE / 2);

export type Direction = 'left' | 'right';

const ARROWS: Record<Direction, string> = { left: '⬅', right: '➡' };

export interface Flock {
  arrows: Direction[];
  /** The direction of the middle arrow — the only one that counts. */
  answer: Direction;
}

/**
 * A row of arrows where the outer ones either agree with the middle one or all
 * point the other way. The disagreeing case is the whole point: it takes
 * deliberate attention to ignore the crowd.
 */
export function makeFlock(congruent: boolean, rng: Rng = defaultRng): Flock {
  const answer = pick(['left', 'right'] as const, rng);
  const others: Direction = congruent ? answer : answer === 'left' ? 'right' : 'left';
  const arrows = Array.from({ length: FLOCK_SIZE }, (_, i) => (i === CENTRE ? answer : others));
  return { arrows, answer };
}

export const arrowFlock: Game = {
  id: 'arrow-flock',
  name: 'Arrow Flock',
  category: 'Flexibility',
  blurb: 'Which way is the middle arrow pointing?',
  icon: '➡',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Which way is the MIDDLE arrow pointing?',
      async playRound(view) {
        const flock = makeFlock(chance(0.4));

        const arrows = flock.arrows.map((direction, index) =>
          el('span', {
            className: `flock-arrow${index === CENTRE ? ' is-centre' : ''}`,
            text: ARROWS[direction],
            label: index === CENTRE ? `middle arrow pointing ${direction}` : `arrow pointing ${direction}`,
          }),
        );
        view.stage.appendChild(el('div', { className: 'flock', children: arrows }));

        const answer = await askButtons(view, ['⬅ Left', 'Right ➡']);
        return answer !== null && (answer === 0 ? 'left' : 'right') === flock.answer;
      },
    });
  },
};
