import { describe, expect, it, vi } from 'vitest';
import type { Game, GameResult, PlayOptions } from '../src/games/types';
import { buildPlaylist, type PlayItem } from '../src/session/playlist';
import {
  ABORT_SESSION_ENDED,
  ABORT_WATCHDOG,
  runSession,
  type SessionDeps,
} from '../src/session/runner';

/** A game that finishes immediately and records that it was played. */
function fakeGame(id: string, played: string[], result: GameResult = { correct: 1, rounds: 1 }): Game {
  return {
    id,
    name: id,
    category: 'Speed',
    blurb: '',
    icon: '?',
    async play(container: HTMLElement): Promise<GameResult> {
      played.push(id);
      container.appendChild(document.createElement('span'));
      return result;
    },
  };
}

function deps(games: Game[], overrides: Partial<SessionDeps> = {}): SessionDeps {
  const byId = new Map(games.map((game) => [game.id, game]));
  return {
    getGame: (id) => byId.get(id),
    container: document.createElement('div'),
    announce: async () => {},
    signal: new AbortController().signal,
    watchdogMs: 50,
    ...overrides,
  };
}

function playlist(gameIds: string[], sets = 1) {
  return buildPlaylist({
    version: 1,
    queue: gameIds.map((gameId) => ({ gameId, pace: 'steady' as const })),
    sets,
  });
}

describe('runSession', () => {
  it('plays every game in order without any input between them', async () => {
    const played: string[] = [];
    const games = [fakeGame('a', played), fakeGame('b', played), fakeGame('c', played)];

    const summary = await runSession(playlist(['a', 'b', 'c']), deps(games));

    expect(played).toEqual(['a', 'b', 'c']);
    expect(summary.completed).toBe(true);
    expect(summary.outcomes).toHaveLength(3);
  });

  it('repeats the queue for every set — the whole point of the app', async () => {
    const played: string[] = [];
    const games = [fakeGame('a', played), fakeGame('b', played)];

    await runSession(playlist(['a', 'b'], 2), deps(games));

    expect(played).toEqual(['a', 'b', 'a', 'b']);
  });

  it('announces each game before playing it', async () => {
    const played: string[] = [];
    const announce = vi.fn(async (_item: PlayItem, _total: number) => {});

    await runSession(playlist(['a', 'b']), deps([fakeGame('a', played), fakeGame('b', played)], { announce }));

    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce.mock.calls[0][0].gameId).toBe('a');
    expect(announce.mock.calls[0][1]).toBe(2); // total games, for "Game 1 of 2"
  });

  it('totals up what was answered across the session', async () => {
    const played: string[] = [];
    const games = [
      fakeGame('a', played, { correct: 3, rounds: 5 }),
      fakeGame('b', played, { correct: 4, rounds: 5 }),
    ];

    const summary = await runSession(playlist(['a', 'b']), deps(games));

    expect(summary.correct).toBe(7);
    expect(summary.rounds).toBe(10);
  });

  it('keeps going when a game throws, instead of stranding the session', async () => {
    const played: string[] = [];
    const exploding: Game = {
      ...fakeGame('boom', played),
      async play(): Promise<GameResult> {
        throw new Error('this game is broken');
      },
    };

    const summary = await runSession(
      playlist(['a', 'boom', 'b']),
      deps([fakeGame('a', played), exploding, fakeGame('b', played)]),
    );

    expect(played).toEqual(['a', 'b']);
    expect(summary.outcomes.map((o) => o.status)).toEqual(['played', 'error', 'played']);
    expect(summary.completed).toBe(true);
  });

  it('force-advances past a game that hangs forever', async () => {
    const played: string[] = [];
    const hanging: Game = {
      ...fakeGame('hang', played),
      play: () => new Promise<GameResult>(() => {}), // never resolves, ignores the signal
    };

    const summary = await runSession(
      playlist(['hang', 'b']),
      deps([hanging, fakeGame('b', played)], { watchdogMs: 30 }),
    );

    expect(summary.outcomes[0].status).toBe('timeout');
    expect(played).toEqual(['b']);
  });

  it('aborts the running game when the watchdog fires', async () => {
    let sawAbort = false;
    const stubborn: Game = {
      id: 'stubborn',
      name: 'stubborn',
      category: 'Speed',
      blurb: '',
      icon: '?',
      play: (_c: HTMLElement, opts: PlayOptions) =>
        new Promise<GameResult>(() => {
          opts.signal.addEventListener('abort', () => {
            sawAbort = true;
          });
        }),
    };

    await runSession(playlist(['stubborn']), deps([stubborn], { watchdogMs: 20 }));

    expect(sawAbort).toBe(true);
  });

  it('skips a game id that is no longer in the library', async () => {
    const played: string[] = [];

    const summary = await runSession(
      playlist(['gone', 'a']),
      deps([fakeGame('a', played)]),
    );

    expect(summary.outcomes[0].status).toBe('missing');
    expect(played).toEqual(['a']);
  });

  it('stops early when the caregiver ends the session', async () => {
    const played: string[] = [];
    const control = new AbortController();
    const games = [fakeGame('a', played), fakeGame('b', played), fakeGame('c', played)];

    const summary = await runSession(
      playlist(['a', 'b', 'c']),
      deps(games, {
        signal: control.signal,
        announce: async (item) => {
          if (item.overallIndex === 2) control.abort();
        },
      }),
    );

    expect(played).toEqual(['a', 'b']);
    expect(summary.completed).toBe(false);
    expect(summary.planned).toBe(3);
  });

  it('cancels the game in flight when the caregiver ends the session', async () => {
    const control = new AbortController();
    let abortReason: unknown = null;
    let hasStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      hasStarted = resolve;
    });

    const slow: Game = {
      id: 'slow',
      name: 'slow',
      category: 'Speed',
      blurb: '',
      icon: '?',
      play: (_c: HTMLElement, opts: PlayOptions) =>
        new Promise<GameResult>((resolve) => {
          hasStarted();
          opts.signal.addEventListener('abort', () => {
            abortReason = opts.signal.reason;
            resolve({ correct: 0, rounds: 0 });
          });
        }),
    };

    const run = runSession(playlist(['slow']), deps([slow], { signal: control.signal, watchdogMs: 5000 }));
    await started; // only end the session once the game is genuinely in flight
    control.abort();
    await run;

    // Proves it was the caregiver stopping the session, not the watchdog or
    // the normal end-of-game cleanup.
    expect(abortReason).toBe(ABORT_SESSION_ENDED);
  });

  it('tells a game it was stopped by the watchdog rather than by the caregiver', async () => {
    let abortReason: unknown = null;
    const hanging: Game = {
      id: 'hang',
      name: 'hang',
      category: 'Speed',
      blurb: '',
      icon: '?',
      play: (_c: HTMLElement, opts: PlayOptions) =>
        new Promise<GameResult>(() => {
          opts.signal.addEventListener('abort', () => {
            abortReason = opts.signal.reason;
          });
        }),
    };

    await runSession(playlist(['hang']), deps([hanging], { watchdogMs: 20 }));

    expect(abortReason).toBe(ABORT_WATCHDOG);
  });

  it('clears the screen between games so nothing bleeds through', async () => {
    const played: string[] = [];
    const container = document.createElement('div');

    await runSession(playlist(['a', 'b']), deps([fakeGame('a', played), fakeGame('b', played)], { container }));

    expect(container.childNodes).toHaveLength(0);
  });
});
