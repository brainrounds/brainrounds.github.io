import { askButtons } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { chance, defaultRng, pick, randInt, type Rng } from '../util/random';
import { SHAPES, shapeByName } from './palette';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 8, answerMs: 7000, showMs: 0 },
  steady: { rounds: 12, answerMs: 5000, showMs: 0 },
  brisk: { rounds: 16, answerMs: 3200, showMs: 0 },
};

const PANEL_SIZE = 4;

export interface Panels {
  left: string[];
  right: string[];
}

/**
 * Two panels of shapes that are either identical or differ in exactly one
 * position. The single difference is forced rather than left to chance, so the
 * expected answer is always the true one.
 */
export function makePanels(shouldMatch: boolean, rng: Rng = defaultRng): Panels {
  const names = SHAPES.map((shape) => shape.name);
  const left = Array.from({ length: PANEL_SIZE }, () => pick(names, rng));
  const right = left.slice();
  if (!shouldMatch) {
    const index = randInt(0, PANEL_SIZE - 1, rng);
    right[index] = pick(names.filter((name) => name !== left[index]), rng);
  }
  return { left, right };
}

export function panelsAreSame(panels: Panels): boolean {
  return panels.left.every((shape, i) => shape === panels.right[i]);
}

function renderPanel(host: HTMLElement, shapes: string[], label: string): void {
  const glyphs = shapes.map((name) =>
    el('span', { className: 'panel-shape', text: shapeByName(name).glyph }),
  );
  host.appendChild(el('div', { className: 'compare-panel', label, children: glyphs }));
}

export const sameOrDifferent: Game = {
  id: 'same-or-different',
  name: 'Same or Different',
  category: 'Speed',
  blurb: 'Are the two boxes the same, or different?',
  icon: '🔀',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Are these two boxes the same, or different?',
      async playRound(view) {
        const panels = makePanels(chance(0.5));
        const expectedSame = panelsAreSame(panels);

        const row = el('div', { className: 'panel-pair' });
        view.stage.appendChild(row);
        renderPanel(row, panels.left, 'left box');
        renderPanel(row, panels.right, 'right box');

        const answer = await askButtons(view, ['Same', 'Different']);
        return answer !== null && (answer === 0) === expectedSame;
      },
    });
  },
};
