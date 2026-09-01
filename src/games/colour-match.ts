import { askButtons } from '../ui/ask';
import { el } from '../ui/dom';
import { playRounds } from '../ui/round-runner';
import { chance, defaultRng, pick, type Rng } from '../util/random';
import { COLOURS, colourByName } from './palette';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 8, answerMs: 8000, showMs: 0 },
  steady: { rounds: 12, answerMs: 5500, showMs: 0 },
  brisk: { rounds: 16, answerMs: 3500, showMs: 0 },
};

export interface ColourWord {
  /** The word that is written. */
  word: string;
  /** The colour it is written in. */
  ink: string;
}

export interface StroopPair {
  top: ColourWord;
  bottom: ColourWord;
}

/**
 * The classic interference task: the answer depends on the top word's *ink*
 * and the bottom word's *meaning*, so the two readings of each word pull
 * against each other.
 */
export function makeStroopPair(shouldMatch: boolean, rng: Rng = defaultRng): StroopPair {
  const names = COLOURS.map((colour) => colour.name);
  const top: ColourWord = { word: pick(names, rng), ink: pick(names, rng) };
  const bottomWord = shouldMatch ? top.ink : pick(names.filter((name) => name !== top.ink), rng);
  return {
    top,
    bottom: { word: bottomWord, ink: pick(names, rng) },
  };
}

/** True when the bottom word's meaning names the colour the top word is written in. */
export function stroopAnswer(pair: StroopPair): boolean {
  return pair.bottom.word === pair.top.ink;
}

export const colourMatch: Game = {
  id: 'colour-match',
  name: 'Colour Match',
  category: 'Flexibility',
  blurb: 'Does the bottom word name the colour the top word is written in?',
  icon: '🎨',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Does the bottom word name the colour of the top word?',
      async playRound(view) {
        const pair = makeStroopPair(chance(0.5));
        const expected = stroopAnswer(pair);

        for (const [word, hint] of [
          [pair.top, 'top word'],
          [pair.bottom, 'bottom word'],
        ] as const) {
          view.stage.appendChild(
            el('div', {
              className: 'stroop-word',
              text: word.word.toUpperCase(),
              label: `${hint}: ${word.word} written in ${word.ink}`,
              style: { color: colourByName(word.ink).hex },
            }),
          );
        }

        const answer = await askButtons(view, ['Yes', 'No']);
        return answer !== null && (answer === 0) === expected;
      },
    });
  },
};
