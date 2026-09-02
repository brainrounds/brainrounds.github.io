import { describe, expect, it } from 'vitest';
import type { Config } from '../src/config/config';
import { buildPlaylist } from '../src/session/playlist';

function config(gameIds: string[], sets: number): Config {
  return {
    version: 1,
    queue: gameIds.map((gameId) => ({ gameId, pace: 'steady' as const })),
    sets,
  };
}

describe('buildPlaylist', () => {
  it('plays the whole queue once per set, in order', () => {
    const items = buildPlaylist(config(['a', 'b', 'c'], 2));

    expect(items.map((item) => item.gameId)).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  it('produces the poster\'s routine: eleven games, two sets, twenty-two entries', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `game-${i}`);

    const items = buildPlaylist(config(eleven, 2));

    expect(items).toHaveLength(22);
    expect(items[0].gameId).toBe('game-0');
    expect(items[11].gameId).toBe('game-0');
    expect(items[21].gameId).toBe('game-10');
  });

  it('numbers each entry within its set and across the session', () => {
    const items = buildPlaylist(config(['a', 'b'], 2));

    expect(items.map((item) => item.setIndex)).toEqual([0, 0, 1, 1]);
    expect(items.map((item) => item.positionInSet)).toEqual([0, 1, 0, 1]);
    expect(items.map((item) => item.overallIndex)).toEqual([0, 1, 2, 3]);
  });

  it('flags the start of every set after the first, so a break can be shown', () => {
    const items = buildPlaylist(config(['a', 'b'], 3));

    expect(items.map((item) => item.startsNewSet)).toEqual([false, false, true, false, true, false]);
  });

  it('keeps the pace recorded against each entry', () => {
    const items = buildPlaylist({
      version: 1,
      queue: [
        { gameId: 'a', pace: 'gentle' },
        { gameId: 'b', pace: 'brisk' },
      ],
      sets: 2,
    });

    expect(items.map((item) => item.pace)).toEqual(['gentle', 'brisk', 'gentle', 'brisk']);
  });

  it('allows the same game more than once, at different paces', () => {
    const items = buildPlaylist({
      version: 1,
      queue: [
        { gameId: 'a', pace: 'gentle' },
        { gameId: 'a', pace: 'brisk' },
      ],
      sets: 1,
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.pace)).toEqual(['gentle', 'brisk']);
  });

  it('returns nothing to play when the queue is empty', () => {
    expect(buildPlaylist(config([], 2))).toEqual([]);
  });
});
