import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from '../src/games/registry';
import { followTheCup } from '../src/games/follow-the-cup';
import type { Game } from '../src/games/types';

/**
 * Does each game actually put something on the screen?
 *
 * The rest of the suite proves a game *finishes*. That is not the same thing.
 * Follow the Cup once passed every test while being completely unplayable: it
 * "shuffled" by reordering identical cups in the DOM, so nothing appeared to
 * move and there was no way to follow the ball. It terminated perfectly.
 *
 * These tests watch a game play and assert it showed a real instruction, drew
 * something into the stage, and offered something to tap.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

interface Observed {
  prompts: Set<string>;
  maxButtons: number;
  sawStageContent: boolean;
}

/**
 * Play a game for a few seconds of virtual time, sampling often enough to catch
 * every phase — a stimulus that is shown then hidden, and the brief gap between
 * rounds where the stage is deliberately empty.
 */
async function observe(game: Game, ms = 12_000, step = 100): Promise<Observed> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const control = new AbortController();

  const seen: Observed = { prompts: new Set(), maxButtons: 0, sawStageContent: false };
  const playing = game.play(container, { pace: 'steady', signal: control.signal });

  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await vi.advanceTimersByTimeAsync(step);
    const prompt = container.querySelector('.game-prompt')?.textContent?.trim();
    if (prompt) seen.prompts.add(prompt);
    seen.maxButtons = Math.max(seen.maxButtons, container.querySelectorAll('button').length);
    if ((container.querySelector('.game-stage')?.childElementCount ?? 0) > 0) {
      seen.sawStageContent = true;
    }
  }

  control.abort();
  await vi.advanceTimersByTimeAsync(1000);
  await playing;
  container.remove();
  return seen;
}

describe('every game draws a playable screen', () => {
  for (const game of GAMES) {
    it(`${game.name} shows an instruction, draws a board, and offers something to tap`, async () => {
      const seen = await observe(game);

      // A real instruction, not an empty node.
      expect([...seen.prompts].every((text) => text.length >= 10)).toBe(true);
      expect(seen.prompts.size).toBeGreaterThan(0);

      // Something was actually drawn into the play area.
      expect(seen.sawStageContent).toBe(true);

      // And the player has a way to answer.
      expect(seen.maxButtons).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('Follow the Cup — the regression that started these tests', () => {
  it('visibly moves the cups instead of silently reordering identical ones', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const control = new AbortController();

    const positions = new Set<string>();
    const playing = followTheCup.play(container, { pace: 'steady', signal: control.signal });

    for (let elapsed = 0; elapsed < 12_000; elapsed += 100) {
      await vi.advanceTimersByTimeAsync(100);
      const cups = [...container.querySelectorAll<HTMLElement>('.cup')];
      if (cups.length) positions.add(cups.map((cup) => cup.style.transform).join('|'));
    }

    control.abort();
    await vi.advanceTimersByTimeAsync(1000);
    await playing;
    container.remove();

    // More than one arrangement means the cups genuinely travelled across the
    // screen. Reordering identical DOM nodes would leave this at exactly one.
    expect(positions.size).toBeGreaterThan(1);
  });
});
