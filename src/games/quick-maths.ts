import { askButtons } from '../ui/ask';
import { playRounds } from '../ui/round-runner';
import { defaultRng, randInt, type Rng } from '../util/random';
import type { Game, GameResult, Pace, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 8, answerMs: 12000, showMs: 0 },
  steady: { rounds: 10, answerMs: 9000, showMs: 0 },
  brisk: { rounds: 12, answerMs: 6000, showMs: 0 },
};

export function maxOperandForPace(pace: Pace): number {
  return pace === 'gentle' ? 9 : pace === 'steady' ? 12 : 20;
}

export interface Sum {
  left: number;
  right: number;
  operator: '+' | '−';
  value: number;
}

export interface SumPair {
  first: Sum;
  second: Sum;
  /** Which of the two is worth more. Never a tie. */
  answer: 'first' | 'second';
}

export function makeSum(max: number, rng: Rng = defaultRng): Sum {
  const left = randInt(2, max, rng);
  const right = randInt(1, Math.max(1, Math.min(left, max)), rng);
  // Subtraction only when it stays positive, so the answer is never negative.
  const operator = left > right && rng() < 0.4 ? '−' : '+';
  return {
    left,
    right,
    operator,
    value: operator === '+' ? left + right : left - right,
  };
}

export function formatSum(sum: Sum): string {
  return `${sum.left} ${sum.operator} ${sum.right}`;
}

/**
 * Two sums with genuinely different totals. A tie is regenerated rather than
 * offered, because "tap the bigger one" has no honest answer when they match.
 */
export function makeSumPair(max: number, rng: Rng = defaultRng): SumPair {
  const first = makeSum(max, rng);
  let second = makeSum(max, rng);
  for (let attempt = 0; second.value === first.value && attempt < 20; attempt++) {
    second = makeSum(max, rng);
  }
  if (second.value === first.value) {
    // Re-rolling has failed twenty times, which effectively never happens.
    // Adding to the left operand shifts the total by at least one whichever
    // operator was in play, so the tie is broken by construction rather than
    // by another roll of the dice.
    second = {
      left: second.left + 1,
      right: second.right,
      operator: '+',
      value: second.left + 1 + second.right,
    };
  }
  return { first, second, answer: first.value > second.value ? 'first' : 'second' };
}

export const quickMaths: Game = {
  id: 'quick-maths',
  name: 'Quick Maths',
  category: 'Math',
  blurb: 'Tap whichever sum comes to the bigger number.',
  icon: '➕',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    const max = maxOperandForPace(opts.pace);
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Which one comes to the bigger number?',
      async playRound(view) {
        const pair = makeSumPair(max);
        const answer = await askButtons(view, [formatSum(pair.first), formatSum(pair.second)]);
        return answer !== null && (answer === 0 ? 'first' : 'second') === pair.answer;
      },
    });
  },
};
