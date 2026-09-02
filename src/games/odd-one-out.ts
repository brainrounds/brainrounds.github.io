import { tapOne } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { chance, defaultRng, pick, randInt, type Rng } from '../util/random';
import { COLOURS, SHAPES, colourByName, shapeByName } from './palette';
import type { Game, GameResult, Pace, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 8, answerMs: 9000, showMs: 0 },
  steady: { rounds: 10, answerMs: 6500, showMs: 0 },
  brisk: { rounds: 12, answerMs: 4500, showMs: 0 },
};

export function itemCountForPace(pace: Pace): number {
  return pace === 'gentle' ? 6 : pace === 'steady' ? 9 : 12;
}

export interface Item {
  shape: string;
  colour: string;
}

export interface OddGrid {
  items: Item[];
  oddIndex: number;
}

/**
 * A grid where every item is identical except one, which differs in either
 * shape or colour. The odd item is guaranteed to actually differ, so there is
 * always exactly one right answer.
 */
export function makeOddGrid(count: number, rng: Rng = defaultRng): OddGrid {
  const base: Item = { shape: pick(SHAPES, rng).name, colour: pick(COLOURS, rng).name };
  const items = Array.from({ length: count }, () => ({ ...base }));
  const oddIndex = randInt(0, count - 1, rng);

  if (chance(0.5, rng)) {
    items[oddIndex].shape = pick(
      SHAPES.filter((shape) => shape.name !== base.shape),
      rng,
    ).name;
  } else {
    items[oddIndex].colour = pick(
      COLOURS.filter((colour) => colour.name !== base.colour),
      rng,
    ).name;
  }

  return { items, oddIndex };
}

export const oddOneOut: Game = {
  id: 'odd-one-out',
  name: 'Odd One Out',
  category: 'Attention',
  blurb: 'One shape is different from the rest. Tap it.',
  icon: '🔍',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    const count = itemCountForPace(opts.pace);
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Tap the one that is different.',
      async playRound(view) {
        const grid = makeOddGrid(count);
        const nodes = grid.items.map((item, index) => {
          const node = el('button', {
            className: 'tile shape-tile',
            text: shapeByName(item.shape).glyph,
            label: `${item.colour} ${item.shape}, number ${index + 1}`,
            style: { color: colourByName(item.colour).hex },
          });
          node.type = 'button';
          return node;
        });
        view.stage.appendChild(el('div', { className: 'grid grid-3', children: nodes }));

        const tapped = await tapOne(view, nodes);
        return tapped === grid.oddIndex;
      },
    });
  },
};
