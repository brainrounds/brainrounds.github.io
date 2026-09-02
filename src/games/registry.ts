import { arrowFlock } from './arrow-flock';
import { cardPairs } from './card-pairs';
import { colourMatch } from './colour-match';
import { followTheCup } from './follow-the-cup';
import { gridRecall } from './grid-recall';
import { oddOneOut } from './odd-one-out';
import { patternFill } from './pattern-fill';
import { quickMaths } from './quick-maths';
import { sameOrDifferent } from './same-or-different';
import { sizeOrder } from './size-order';
import { speedSort } from './speed-sort';
import { tapOrder } from './tap-order';
import type { Game } from './types';

/**
 * Every game in the app, grouped by the kind of thinking it exercises so the
 * setup screen reads sensibly top to bottom.
 *
 * This is the single source of truth for the library: the setup screen, the
 * saved-config validator and the session runner all read from here.
 */
export const GAMES: readonly Game[] = [
  speedSort,
  sameOrDifferent,
  gridRecall,
  cardPairs,
  tapOrder,
  followTheCup,
  oddOneOut,
  colourMatch,
  arrowFlock,
  patternFill,
  sizeOrder,
  quickMaths,
];

const BY_ID = new Map(GAMES.map((game) => [game.id, game]));

export function getGame(id: string): Game | undefined {
  return BY_ID.get(id);
}

export function gameIds(): string[] {
  return GAMES.map((game) => game.id);
}
