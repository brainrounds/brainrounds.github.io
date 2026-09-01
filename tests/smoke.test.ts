import { beforeEach, describe, expect, it } from 'vitest';
import { defaultConfig, loadConfig } from '../src/config/config';
import { renderSetup } from '../src/config/setup-view';
import { GAMES, gameIds, getGame } from '../src/games/registry';
import { CATEGORIES, PACES } from '../src/games/types';
import { buildPlaylist } from '../src/session/playlist';

/**
 * Is it on fire? A handful of fast checks that the app is wired together —
 * not that every feature is correct.
 */

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('smoke', () => {
  it('ships twelve games with unique ids', () => {
    expect(GAMES).toHaveLength(12);
    expect(new Set(gameIds()).size).toBe(12);
  });

  it('covers every category a Lumosity routine would draw from', () => {
    const covered = new Set(GAMES.map((game) => game.category));
    for (const category of CATEGORIES) expect(covered).toContain(category);
  });

  it('gives every game the details the setup screen and up-next card need', () => {
    for (const game of GAMES) {
      expect(game.name.length).toBeGreaterThan(0);
      expect(game.blurb.length).toBeGreaterThan(0);
      expect(game.icon.length).toBeGreaterThan(0);
      expect(typeof game.play).toBe('function');
    }
  });

  it('finds every registered game by id', () => {
    for (const id of gameIds()) expect(getGame(id)?.id).toBe(id);
    expect(getGame('not-a-game')).toBeUndefined();
  });

  it('renders the setup screen with a start button and every game listed', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    renderSetup(root, loadConfig(gameIds()), { onStart: () => {}, onPreview: () => {} });

    expect(root.querySelector('.start')).not.toBeNull();
    expect(root.querySelectorAll('.game-card')).toHaveLength(12);
    expect(root.querySelectorAll('.queue-row')).toHaveLength(12);
  });

  it('builds a full playlist straight from the first-run defaults', () => {
    const items = buildPlaylist(defaultConfig(gameIds()));

    expect(items).toHaveLength(24); // twelve games, two sets
    expect(items.every((item) => getGame(item.gameId))).toBe(true);
  });

  it('has a pace entry for every game at every pace', async () => {
    for (const game of GAMES) {
      const module = (await import(`../src/games/${game.id}.ts`)) as { PACE_TABLE: Record<string, unknown> };
      for (const pace of PACES) expect(module.PACE_TABLE[pace]).toBeDefined();
    }
  });
});
