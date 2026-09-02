import { askButtons } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds, type RoundView } from '../ui/round-runner';
import { chance, defaultRng, pick, type Rng } from '../util/random';
import { COLOURS, SHAPES, colourByName, shapeByName } from './palette';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export interface Card {
  shape: string;
  colour: string;
}

/** How often a card is made to match the one before it. */
const MATCH_RATE = 0.5;

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 8, answerMs: 6000, showMs: 1800 },
  steady: { rounds: 12, answerMs: 4000, showMs: 1300 },
  brisk: { rounds: 16, answerMs: 2600, showMs: 900 },
};

export function makeCard(rng: Rng = defaultRng): Card {
  return { shape: pick(SHAPES, rng).name, colour: pick(COLOURS, rng).name };
}

export function isMatch(a: Card, b: Card): boolean {
  return a.shape === b.shape && a.colour === b.colour;
}

/**
 * A card that either matches `previous` exactly, or is guaranteed to differ in
 * at least one of shape and colour. Guaranteeing the difference matters: left
 * to chance, a "different" card would sometimes come out identical and the
 * expected answer would be wrong.
 */
export function makeNextCard(previous: Card, shouldMatch: boolean, rng: Rng = defaultRng): Card {
  if (shouldMatch) return { ...previous };
  const flipShape = chance(0.5, rng);
  return {
    shape: flipShape ? otherThan(SHAPES.map((s) => s.name), previous.shape, rng) : previous.shape,
    colour: flipShape ? previous.colour : otherThan(COLOURS.map((c) => c.name), previous.colour, rng),
  };
}

function otherThan(options: string[], exclude: string, rng: Rng): string {
  const rest = options.filter((option) => option !== exclude);
  return pick(rest, rng);
}

function renderCard(view: RoundView, card: Card): HTMLElement {
  const colour = colourByName(card.colour);
  const node = el('div', {
    className: 'card-face',
    text: shapeByName(card.shape).glyph,
    label: `${card.colour} ${card.shape}`,
    style: { color: colour.hex },
  });
  view.stage.appendChild(node);
  return node;
}

export const speedSort: Game = {
  id: 'speed-sort',
  name: 'Speed Sort',
  category: 'Speed',
  blurb: 'Does this card match the one before it?',
  icon: '⚡',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    let previous: Card | null = null;

    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Does this card match the one before it?',
      async playRound(view, round) {
        // The first round has nothing to compare against, so the opening card
        // is shown on its own before the first real question is asked.
        if (round === 0) {
          previous = makeCard();
          view.prompt('Look at this card.');
          renderCard(view, previous);
          await view.wait(view.showMs);
          if (view.signal.aborted) return false;
          view.stage.textContent = '';
        }

        const current = makeNextCard(previous!, chance(MATCH_RATE));
        const expected = isMatch(current, previous!);
        previous = current;

        view.prompt('Does this card match the one before it?');
        renderCard(view, current);

        const answer = await askButtons(view, ['Yes', 'No']);
        return answer !== null && (answer === 0) === expected;
      },
    });
  },
};
