import { describe, expect, it } from 'vitest';
import { CENTRE, FLOCK_SIZE, makeFlock } from '../src/games/arrow-flock';
import { makeDeck, pairsForPace } from '../src/games/card-pairs';
import { makeStroopPair, stroopAnswer } from '../src/games/colour-match';
import { planSwaps, runShuffle, swapSlots } from '../src/games/follow-the-cup';
import { pickTiles, recallIsCorrect, tileCountForRound } from '../src/games/grid-recall';
import { makeOddGrid } from '../src/games/odd-one-out';
import { SIDE, makePattern } from '../src/games/pattern-fill';
import { formatSum, makeSum, makeSumPair } from '../src/games/quick-maths';
import { makePanels, panelsAreSame } from '../src/games/same-or-different';
import { ascendingOrder, makeSizes, orderIsCorrect as sizeOrderIsCorrect } from '../src/games/size-order';
import { isMatch, makeCard, makeNextCard } from '../src/games/speed-sort';
import { TILE_COUNT, makeSequence, orderIsCorrect, sequenceLengthForRound } from '../src/games/tap-order';
import { seededRng } from '../src/util/random';

/** Run a generator across many seeds — one lucky seed proves nothing. */
function overSeeds(count: number, check: (rng: () => number, seed: number) => void): void {
  for (let seed = 1; seed <= count; seed++) check(seededRng(seed), seed);
}

describe('Speed Sort', () => {
  it('produces an identical card when the round is meant to match', () => {
    overSeeds(50, (rng) => {
      const previous = makeCard(rng);
      expect(isMatch(makeNextCard(previous, true, rng), previous)).toBe(true);
    });
  });

  it('never produces an accidental match when the round is meant to differ', () => {
    overSeeds(200, (rng) => {
      const previous = makeCard(rng);
      expect(isMatch(makeNextCard(previous, false, rng), previous)).toBe(false);
    });
  });

  it('treats a card differing only in colour as not matching', () => {
    expect(isMatch({ shape: 'star', colour: 'red' }, { shape: 'star', colour: 'blue' })).toBe(false);
  });
});

describe('Same or Different', () => {
  it('makes the two boxes identical when they are meant to match', () => {
    overSeeds(50, (rng) => expect(panelsAreSame(makePanels(true, rng))).toBe(true));
  });

  it('always changes exactly one position when they are meant to differ', () => {
    overSeeds(200, (rng) => {
      const panels = makePanels(false, rng);
      const differences = panels.left.filter((shape, i) => shape !== panels.right[i]);
      expect(differences).toHaveLength(1);
    });
  });
});

describe('Grid Recall', () => {
  it('lights up distinct squares', () => {
    overSeeds(50, (rng) => {
      const tiles = pickTiles(5, rng);
      expect(new Set(tiles).size).toBe(5);
      expect(tiles.every((tile) => tile >= 0 && tile < 16)).toBe(true);
    });
  });

  it('accepts the right squares tapped in any order', () => {
    expect(recallIsCorrect([1, 5, 9], [9, 1, 5])).toBe(true);
  });

  it('rejects a missing square, a wrong square, and a short answer', () => {
    expect(recallIsCorrect([1, 5, 9], [1, 5, 8])).toBe(false);
    expect(recallIsCorrect([1, 5, 9], [1, 5])).toBe(false);
    expect(recallIsCorrect([1, 5, 9], [1, 5, 9, 2])).toBe(false);
  });

  it('grows the number of squares with the round but caps it', () => {
    expect(tileCountForRound(0, 'steady')).toBe(3);
    expect(tileCountForRound(3, 'steady')).toBe(4);
    expect(tileCountForRound(99, 'steady')).toBe(6);
    expect(tileCountForRound(0, 'gentle')).toBe(2);
  });
});

describe('Card Pairs', () => {
  it('deals every symbol exactly twice', () => {
    overSeeds(30, (rng) => {
      const deck = makeDeck(4, rng);
      expect(deck).toHaveLength(8);
      const counts = new Map<string, number>();
      for (const symbol of deck) counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
      expect([...counts.values()]).toEqual([2, 2, 2, 2]);
    });
  });

  it('uses a smaller board at the gentlest pace', () => {
    expect(pairsForPace('gentle')).toBeLessThan(pairsForPace('brisk'));
  });
});

describe('Tap Order', () => {
  it('only uses tiles that exist', () => {
    overSeeds(50, (rng) => {
      expect(makeSequence(6, rng).every((tile) => tile >= 0 && tile < TILE_COUNT)).toBe(true);
    });
  });

  it('can repeat a tile, so 1-3-1 is a possible sequence', () => {
    const seen = new Set<string>();
    overSeeds(200, (rng) => {
      const sequence = makeSequence(4, rng);
      if (new Set(sequence).size < sequence.length) seen.add(sequence.join(''));
    });
    expect(seen.size).toBeGreaterThan(0);
  });

  it('requires the same tiles in the same order', () => {
    expect(orderIsCorrect([0, 2, 1], [0, 2, 1])).toBe(true);
    expect(orderIsCorrect([0, 2, 1], [0, 1, 2])).toBe(false);
    expect(orderIsCorrect([0, 2, 1], [0, 2])).toBe(false);
  });

  it('lengthens the sequence with the round but caps it', () => {
    expect(sequenceLengthForRound(0)).toBe(3);
    expect(sequenceLengthForRound(2)).toBe(4);
    expect(sequenceLengthForRound(99)).toBe(6);
  });
});

describe('Follow the Cup', () => {
  it('never plans a swap of a cup with itself, which would look like nothing happened', () => {
    overSeeds(100, (rng) => {
      for (const [a, b] of planSwaps(3, 5, rng)) expect(a).not.toBe(b);
    });
  });

  it('moves the two cups in the named slots and leaves the rest alone', () => {
    expect(swapSlots([0, 1, 2], 0, 2)).toEqual([2, 1, 0]);
    expect(swapSlots([2, 0, 1], 0, 1)).toEqual([2, 1, 0]);
  });

  it('always ends with one cup per slot, however many swaps happen', () => {
    overSeeds(100, (rng) => {
      const slots = runShuffle(4, planSwaps(4, 5, rng));
      expect([...slots].sort()).toEqual([0, 1, 2, 3]);
    });
  });

  it('returns the cups to where they started after the same swap twice', () => {
    expect(runShuffle(3, [[0, 2], [0, 2]])).toEqual([0, 1, 2]);
  });
});

describe('Odd One Out', () => {
  it('makes exactly one item different from the rest', () => {
    overSeeds(200, (rng) => {
      const grid = makeOddGrid(9, rng);
      const odd = grid.items[grid.oddIndex];
      const others = grid.items.filter((_, i) => i !== grid.oddIndex);
      expect(others.every((item) => item.shape === others[0].shape && item.colour === others[0].colour)).toBe(true);
      expect(odd.shape !== others[0].shape || odd.colour !== others[0].colour).toBe(true);
    });
  });
});

describe('Colour Match', () => {
  it('answers yes exactly when the bottom word names the top word\'s ink', () => {
    overSeeds(200, (rng) => {
      expect(stroopAnswer(makeStroopPair(true, rng))).toBe(true);
      expect(stroopAnswer(makeStroopPair(false, rng))).toBe(false);
    });
  });

  it('sometimes writes a word in a colour it does not name — the whole point of the task', () => {
    let conflicting = 0;
    overSeeds(100, (rng) => {
      const pair = makeStroopPair(true, rng);
      if (pair.top.word !== pair.top.ink) conflicting++;
    });
    expect(conflicting).toBeGreaterThan(0);
  });
});

describe('Arrow Flock', () => {
  it('puts the answer in the middle and the crowd around it', () => {
    overSeeds(100, (rng) => {
      const flock = makeFlock(false, rng);
      expect(flock.arrows).toHaveLength(FLOCK_SIZE);
      expect(flock.arrows[CENTRE]).toBe(flock.answer);
      expect(flock.arrows.filter((_, i) => i !== CENTRE).every((d) => d !== flock.answer)).toBe(true);
    });
  });

  it('points the whole flock the same way when they agree', () => {
    overSeeds(50, (rng) => {
      const flock = makeFlock(true, rng);
      expect(flock.arrows.every((d) => d === flock.answer)).toBe(true);
    });
  });
});

describe('Pattern Fill', () => {
  it('leaves exactly one gap and offers the shape that fills it', () => {
    overSeeds(100, (rng) => {
      const pattern = makePattern(rng);
      expect(pattern.cells.filter((cell) => cell === null)).toHaveLength(1);
      expect(pattern.options).toContain(pattern.answer);
    });
  });

  it('builds a grid where every row and column holds each shape once, so the gap is solvable', () => {
    overSeeds(100, (rng) => {
      const pattern = makePattern(rng);
      const filled = pattern.cells.map((cell) => cell ?? pattern.answer);
      for (let i = 0; i < SIDE; i++) {
        const row = filled.slice(i * SIDE, i * SIDE + SIDE);
        const column = [0, 1, 2].map((r) => filled[r * SIDE + i]);
        expect(new Set(row).size).toBe(SIDE);
        expect(new Set(column).size).toBe(SIDE);
      }
    });
  });
});

describe('Size Order', () => {
  it('offers circles of genuinely different sizes', () => {
    overSeeds(50, (rng) => {
      const sizes = makeSizes(4, rng);
      expect(new Set(sizes).size).toBe(4);
    });
  });

  it('orders indexes smallest to largest', () => {
    expect(ascendingOrder([90, 40, 70])).toEqual([1, 2, 0]);
  });

  it('accepts only the full run in the right order', () => {
    expect(sizeOrderIsCorrect([90, 40, 70], [1, 2, 0])).toBe(true);
    expect(sizeOrderIsCorrect([90, 40, 70], [1, 0, 2])).toBe(false);
    expect(sizeOrderIsCorrect([90, 40, 70], [1, 2])).toBe(false);
  });
});

describe('Quick Maths', () => {
  it('never asks a subtraction that goes below zero', () => {
    overSeeds(300, (rng) => {
      const sum = makeSum(12, rng);
      expect(sum.value).toBeGreaterThanOrEqual(0);
    });
  });

  it('works the sum out correctly', () => {
    overSeeds(300, (rng) => {
      const sum = makeSum(20, rng);
      const expected = sum.operator === '+' ? sum.left + sum.right : sum.left - sum.right;
      expect(sum.value).toBe(expected);
    });
  });

  it('never offers two sums with the same total, which would have no right answer', () => {
    overSeeds(400, (rng) => {
      const pair = makeSumPair(9, rng);
      expect(pair.first.value).not.toBe(pair.second.value);
    });
  });

  it('names whichever sum is actually bigger', () => {
    overSeeds(400, (rng) => {
      const pair = makeSumPair(12, rng);
      const bigger = pair.first.value > pair.second.value ? 'first' : 'second';
      expect(pair.answer).toBe(bigger);
    });
  });

  it('writes a sum the way it is read aloud', () => {
    expect(formatSum({ left: 7, right: 4, operator: '+', value: 11 })).toBe('7 + 4');
  });
});
