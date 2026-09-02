import type { Game } from '../games/types';
import { raceTimeout } from '../util/async';
import type { PlayItem } from './playlist';

/**
 * The longest a single game may run before the runner gives up on it and moves
 * to the next one. No pace lets a game legitimately approach this, so hitting
 * it always means the game is stuck.
 */
export const WATCHDOG_MS = 180_000;

/** Why a game's signal was aborted. Surfaced on `signal.reason`. */
export const ABORT_SESSION_ENDED = 'session-ended';
export const ABORT_WATCHDOG = 'watchdog';
export const ABORT_GAME_OVER = 'game-over';

export type PlayStatus = 'played' | 'timeout' | 'error' | 'missing';

export interface PlayOutcome {
  item: PlayItem;
  correct: number;
  rounds: number;
  status: PlayStatus;
}

export interface SessionSummary {
  /** How many games the session was supposed to play. */
  planned: number;
  outcomes: PlayOutcome[];
  correct: number;
  rounds: number;
  /** False when the caregiver ended the session early. */
  completed: boolean;
}

export interface SessionDeps {
  getGame(id: string): Game | undefined;
  /** The element games draw into. Cleared before and after every game. */
  container: HTMLElement;
  /** Show the "up next" screen. Resolves when it is time to start playing. */
  announce(item: PlayItem, total: number): Promise<void>;
  /** Aborted when the caregiver ends the session early. */
  signal: AbortSignal;
  watchdogMs?: number;
}

/**
 * Play every item in order, starting the next one the moment the previous
 * resolves. This loop is the entire feature: nobody has to sit and drive it.
 *
 * A game that throws, is missing, or hangs is recorded and skipped — the
 * session always keeps going, because a stalled queue is the one failure that
 * would put the caregiver back in front of the screen.
 */
export async function runSession(items: PlayItem[], deps: SessionDeps): Promise<SessionSummary> {
  const outcomes: PlayOutcome[] = [];

  for (const item of items) {
    if (deps.signal.aborted) break;
    await deps.announce(item, items.length);
    if (deps.signal.aborted) break;
    outcomes.push(await playOne(item, deps));
  }

  return {
    planned: items.length,
    outcomes,
    correct: outcomes.reduce((sum, o) => sum + o.correct, 0),
    rounds: outcomes.reduce((sum, o) => sum + o.rounds, 0),
    completed: outcomes.length === items.length,
  };
}

async function playOne(item: PlayItem, deps: SessionDeps): Promise<PlayOutcome> {
  const game = deps.getGame(item.gameId);
  if (!game) return { item, correct: 0, rounds: 0, status: 'missing' };

  // A per-game controller so ending one game never cancels the session, while
  // ending the session still cancels the game in flight. Each abort carries a
  // reason, which is what tells a game — and anyone reading a bug report —
  // whether it was stopped by the caregiver, by the watchdog, or normally.
  const control = new AbortController();
  const stopOnSessionEnd = (): void => control.abort(ABORT_SESSION_ENDED);
  deps.signal.addEventListener('abort', stopOnSessionEnd, { once: true });

  const timedOut = Symbol('timed-out');
  try {
    deps.container.textContent = '';
    const played = game.play(deps.container, { pace: item.pace, signal: control.signal });
    // Race the watchdog rather than relying on the abort alone: a game that
    // ignores its signal must still not be able to stall the queue.
    const result = await raceTimeout<Awaited<typeof played> | typeof timedOut>(
      played,
      deps.watchdogMs ?? WATCHDOG_MS,
      timedOut,
    );
    if (result === timedOut) {
      control.abort(ABORT_WATCHDOG);
      return { item, correct: 0, rounds: 0, status: 'timeout' };
    }
    return { item, correct: result.correct, rounds: result.rounds, status: 'played' };
  } catch {
    return { item, correct: 0, rounds: 0, status: 'error' };
  } finally {
    control.abort(ABORT_GAME_OVER); // no-op if it was already aborted above
    deps.signal.removeEventListener('abort', stopOnSessionEnd);
    deps.container.textContent = '';
  }
}
