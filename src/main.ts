import './styles.css';
import { loadConfig, type Config } from './config/config';
import { saveLastSession } from './config/last-session';
import { renderSetup } from './config/setup-view';
import { gameIds } from './games/registry';
import type { Pace } from './games/types';
import { runSessionScreen } from './session/session-view';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app');

blockStrayGestures();
void registerServiceWorker();
showSetup(root);

function showSetup(host: HTMLElement): void {
  renderSetup(host, loadConfig(gameIds()), {
    onStart: (config) => void play(host, config, true),
    // A preview runs the real thing for one game, so what the caregiver tries
    // is exactly what the player will get.
    onPreview: (gameId: string, pace: Pace) =>
      void play(host, { version: 1, queue: [{ gameId, pace }], sets: 1 }, false),
  });
}

async function play(host: HTMLElement, config: Config, record: boolean): Promise<void> {
  const { summary, minutes } = await runSessionScreen(config, host);
  if (record) {
    saveLastSession({
      finishedAt: new Date().toISOString(),
      gamesPlayed: summary.outcomes.length,
      gamesPlanned: summary.planned,
      minutes,
      completed: summary.completed,
    });
  }
  showSetup(host);
}

/**
 * Stop the browser's own gestures from interrupting a session.
 *
 * On an Android tablet a downward drag triggers pull-to-refresh, which would
 * reload the page and destroy a session in progress; a long press raises a
 * text-selection menu over the game. Neither is something the player meant to
 * do. The rest — double-tap zoom, text selection — is handled in CSS.
 */
function blockStrayGestures(): void {
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('dragstart', (event) => event.preventDefault());
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    // Relative, so it works from a project sub-path as well as a domain root.
    await navigator.serviceWorker.register('./sw.js');
  } catch {
    // Offline support is a bonus; the app works without it.
  }
}
