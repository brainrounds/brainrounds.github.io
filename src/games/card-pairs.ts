import { el } from '../ui/dom';
import { playRounds, type RoundView } from '../ui/round-runner';
import { deferred, wait } from '../util/async';
import { defaultRng, sample, shuffle, type Rng } from '../util/random';
import { SHAPES } from './palette';
import type { Game, GameResult, PaceTable, PlayOptions } from './types';

export const PACE_TABLE: PaceTable = {
  // One board per round, so the answer window is the time allowed for a board.
  gentle: { rounds: 2, answerMs: 60_000, showMs: 900 },
  steady: { rounds: 3, answerMs: 45_000, showMs: 700 },
  brisk: { rounds: 3, answerMs: 35_000, showMs: 500 },
};

export function pairsForPace(pace: keyof PaceTable): number {
  return pace === 'gentle' ? 3 : pace === 'steady' ? 4 : 6;
}

/** A shuffled board holding each symbol exactly twice. */
export function makeDeck(pairs: number, rng: Rng = defaultRng): string[] {
  const symbols = sample(SHAPES.map((shape) => shape.glyph), pairs, rng);
  return shuffle([...symbols, ...symbols], rng);
}

export const cardPairs: Game = {
  id: 'card-pairs',
  name: 'Card Pairs',
  category: 'Memory',
  blurb: 'Turn over two cards at a time and find the matching pairs.',
  icon: '🃏',

  async play(container: HTMLElement, opts: PlayOptions): Promise<GameResult> {
    const pairs = pairsForPace(opts.pace);
    return playRounds(container, opts, {
      spec: PACE_TABLE[opts.pace],
      prompt: 'Find the matching pairs.',
      playRound: (view) => playBoard(view, pairs),
    });
  },
};

/**
 * One board. Resolves true when every pair has been found, and false when the
 * board's time runs out — so an unfinished board still moves the session on
 * rather than waiting for a tap that may never come.
 */
async function playBoard(view: RoundView, pairs: number): Promise<boolean> {
  const deck = makeDeck(pairs);
  const solved = deferred<boolean>();
  const cards = deck.map((symbol, index) => buildCard(symbol, index));
  view.stage.appendChild(
    el('div', { className: `grid grid-${pairs * 2 <= 6 ? 3 : 4}`, children: cards.map((c) => c.node) }),
  );

  let flipped: typeof cards = [];
  let found = 0;
  let busy = false;

  for (const card of cards) {
    card.node.addEventListener(
      'click',
      () => {
        if (busy || card.matched || flipped.includes(card)) return;
        show(card, true);
        flipped.push(card);
        if (flipped.length < 2) return;

        const [first, second] = flipped;
        if (first.symbol === second.symbol) {
          first.matched = second.matched = true;
          first.node.classList.add('is-matched');
          second.node.classList.add('is-matched');
          flipped = [];
          found++;
          if (found === pairs) solved.resolve(true);
          return;
        }

        // Leave the mismatched pair visible for a beat, then turn both back.
        busy = true;
        void wait(view.showMs + 400, view.signal).then(() => {
          show(first, false);
          show(second, false);
          flipped = [];
          busy = false;
        });
      },
      { signal: view.signal },
    );
  }

  return Promise.race([solved.promise, wait(view.answerMs, view.signal).then(() => found === pairs)]);
}

interface CardState {
  symbol: string;
  node: HTMLButtonElement;
  matched: boolean;
}

function buildCard(symbol: string, index: number): CardState {
  const node = el('button', { className: 'tile card', text: '', label: `card ${index + 1}` });
  node.type = 'button';
  return { symbol, node, matched: false };
}

function show(card: CardState, faceUp: boolean): void {
  card.node.textContent = faceUp ? card.symbol : '';
  card.node.classList.toggle('is-face-up', faceUp);
}
