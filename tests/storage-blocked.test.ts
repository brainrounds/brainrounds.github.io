import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, saveConfig, defaultConfig } from '../src/config/config';
import { loadLastSession, saveLastSession } from '../src/config/last-session';
import { renderSetup } from '../src/config/setup-view';
import { gameIds } from '../src/games/registry';
import { resetStorageForTests } from '../src/config/storage';

/**
 * Some browsers make `localStorage` unreachable — a sandboxed frame without
 * same-origin, or a "block site data" setting. Reaching for it then throws on
 * PROPERTY ACCESS, before any guard inside a function body can run.
 *
 * Observed for real: the app rendered a blank page inside a sandboxed iframe.
 * Losing the saved queue in that situation is acceptable; losing the whole app
 * is not.
 */

const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function blockStorageAccess(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    },
  });
  resetStorageForTests();
}

afterEach(() => {
  if (real) Object.defineProperty(globalThis, 'localStorage', real);
  resetStorageForTests();
});

describe('when the browser will not let us touch localStorage at all', () => {
  it('still loads a usable config instead of throwing', () => {
    blockStorageAccess();

    expect(() => loadConfig(gameIds())).not.toThrow();
    expect(loadConfig(gameIds())).toEqual(defaultConfig(gameIds()));
  });

  it('does not throw when saving', () => {
    blockStorageAccess();

    expect(() => saveConfig(defaultConfig(gameIds()))).not.toThrow();
  });

  it('does not throw reading or writing the last-session record', () => {
    blockStorageAccess();

    expect(() => saveLastSession({
      finishedAt: '2026-09-02T10:00:00.000Z',
      gamesPlayed: 4,
      gamesPlanned: 4,
      minutes: 5,
      completed: true,
    })).not.toThrow();
    expect(loadLastSession()).toBeNull();
  });

  it('still renders the whole setup screen — a blocked store must not blank the app', () => {
    blockStorageAccess();
    const root = document.createElement('div');

    renderSetup(root, loadConfig(gameIds()), { onStart: () => {}, onPreview: () => {} });

    expect(root.querySelector('.start')).not.toBeNull();
    expect(root.querySelectorAll('.game-card')).toHaveLength(12);
  });
});
