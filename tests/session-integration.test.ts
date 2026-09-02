import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config/config';
import { gameIds } from '../src/games/registry';
import { runSessionScreen } from '../src/session/session-view';

/**
 * The promise the whole app makes: press start once, and a queue of real games
 * plays all the way through — every set — without anybody touching the screen.
 *
 * These run on fake timers so a twenty-minute session takes milliseconds. No
 * clicks are dispatched anywhere: if a game needed a tap to finish, the session
 * would stall and these tests would fail.
 */

const MAX_VIRTUAL_MS = 90 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Run the clock forward until `work` settles, so no test can hang for real. */
async function fastForward<T>(work: Promise<T>): Promise<T> {
  let settled = false;
  const tracked = work.then((value) => {
    settled = true;
    return value;
  });
  for (let elapsed = 0; !settled && elapsed < MAX_VIRTUAL_MS; elapsed += 500) {
    await vi.advanceTimersByTimeAsync(500);
  }
  expect(settled, 'the session never finished on its own').toBe(true);
  return tracked;
}

function config(queue: string[], sets: number): Config {
  return { version: 1, queue: queue.map((gameId) => ({ gameId, pace: 'brisk' as const })), sets };
}

describe('a session running unattended', () => {
  it('plays a queue through both sets with no input at all', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const { summary } = await fastForward(
      runSessionScreen(config(['speed-sort', 'odd-one-out', 'quick-maths'], 2), root),
    );

    expect(summary.planned).toBe(6);
    expect(summary.outcomes).toHaveLength(6);
    expect(summary.completed).toBe(true);
    expect(summary.outcomes.every((outcome) => outcome.status === 'played')).toBe(true);
  });

  it('plays the poster\'s routine — eleven games, twice — start to finish', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const eleven = gameIds().slice(0, 11);

    const { summary } = await fastForward(runSessionScreen(config(eleven, 2), root));

    expect(summary.planned).toBe(22);
    expect(summary.outcomes.map((outcome) => outcome.item.gameId)).toEqual([...eleven, ...eleven]);
    expect(summary.completed).toBe(true);
  });

  it('runs every one of the twelve games without any of them stalling', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const { summary } = await fastForward(runSessionScreen(config(gameIds(), 1), root));

    const stalled = summary.outcomes.filter((outcome) => outcome.status !== 'played');
    expect(stalled.map((outcome) => `${outcome.item.gameId}: ${outcome.status}`)).toEqual([]);
  });

  it('shows every game its turn, counts each one, and finishes on the done screen', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const run = runSessionScreen(config(['speed-sort', 'arrow-flock'], 1), root);
    await vi.advanceTimersByTimeAsync(100);
    expect(root.querySelector('.up-next-name')?.textContent).toBe('Speed Sort');
    expect(root.querySelector('.up-next-progress')?.textContent).toBe('Game 1 of 2');

    await fastForward(run);
    expect(root.querySelector('.all-done-title')?.textContent).toBe('All done');
  });

  it('offers a breather at the start of each new set', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      const note = root.querySelector('.break-note')?.textContent;
      if (note && !seen.includes(note)) seen.push(note);
    });
    observer.observe(root, { childList: true, subtree: true });

    await fastForward(runSessionScreen(config(['speed-sort'], 3), root));
    observer.disconnect();

    expect(seen).toEqual([
      'Take a moment — set 2 of 3 is next.',
      'Take a moment — set 3 of 3 is next.',
    ]);
  });

  it('reports a session that was never started rather than hanging on an empty queue', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    const { summary } = await fastForward(runSessionScreen(config([], 2), root));

    expect(summary.planned).toBe(0);
    expect(summary.outcomes).toEqual([]);
  });
});
