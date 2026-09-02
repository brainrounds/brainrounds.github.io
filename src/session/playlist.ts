import type { Pace } from '../games/types';
import type { Config } from '../config/config';

export interface PlayItem {
  gameId: string;
  pace: Pace;
  /** 0-based set number. Two sets of eleven games gives sets 0 and 1. */
  setIndex: number;
  /** 0-based position within the set. */
  positionInSet: number;
  /** 0-based position across the whole session. */
  overallIndex: number;
  /** True for the first game of every set after the first — the break point. */
  startsNewSet: boolean;
}

/**
 * Flatten a saved queue into the exact ordered list the session plays:
 * the queue repeated once per set.
 *
 * The queue is a list of entries rather than a set of game ids, so the same
 * game may appear more than once, at different paces, and the queue is not
 * fixed to any particular length.
 */
export function buildPlaylist(config: Config): PlayItem[] {
  const items: PlayItem[] = [];
  for (let setIndex = 0; setIndex < config.sets; setIndex++) {
    config.queue.forEach((entry, positionInSet) => {
      items.push({
        gameId: entry.gameId,
        pace: entry.pace,
        setIndex,
        positionInSet,
        overallIndex: items.length,
        startsNewSet: setIndex > 0 && positionInSet === 0,
      });
    });
  }
  return items;
}
