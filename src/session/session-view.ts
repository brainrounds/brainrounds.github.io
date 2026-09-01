import type { Config } from '../config/config';
import { getGame } from '../games/registry';
import { button, clear, el } from '../ui/dom';
import { wait } from '../util/async';
import { buildPlaylist, type PlayItem } from './playlist';
import { runSession, type SessionSummary } from './runner';
import { createScreenWakeLock } from './wake-lock';

/** How long the "up next" card shows before the game starts on its own. */
const INTERSTITIAL_SECONDS = 4;
/** A longer breather between sets. */
const SET_BREAK_SECONDS = 20;
/** How long the exit control must be held. Long enough not to happen by accident. */
const HOLD_TO_EXIT_MS = 2000;

export interface SessionOutcome {
  summary: SessionSummary;
  minutes: number;
}

/**
 * Run a whole session on screen and resolve when it is over.
 *
 * From the moment this starts, nothing needs a caregiver: every game ends
 * itself, the "up next" card counts itself down, and the next game begins.
 */
export async function runSessionScreen(config: Config, root: HTMLElement): Promise<SessionOutcome> {
  const items = buildPlaylist(config);
  const control = new AbortController();
  const wakeLock = createScreenWakeLock();

  const stage = el('div', { className: 'session-stage' });
  const exit = buildExitControl(() => control.abort(), control.signal);
  clear(root);
  root.appendChild(el('div', { className: 'session', children: [stage, exit] }));

  await wakeLock.acquire();
  const startedAt = Date.now();

  const summary = await runSession(items, {
    getGame,
    container: stage,
    signal: control.signal,
    announce: (item, total) => showUpNext(stage, item, total, config.sets, control.signal),
  });

  await wakeLock.release();
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));

  if (!control.signal.aborted) await showAllDone(stage, summary, control.signal);
  return { summary, minutes };
}

/**
 * The card between games. It counts down and starts on its own; the tap is
 * only there for a player who is ready sooner.
 */
async function showUpNext(
  stage: HTMLElement,
  item: PlayItem,
  total: number,
  sets: number,
  signal: AbortSignal,
): Promise<void> {
  const game = getGame(item.gameId);
  if (!game) return;

  const seconds = item.startsNewSet ? SET_BREAK_SECONDS : INTERSTITIAL_SECONDS;
  const counter = el('div', { className: 'countdown', text: String(seconds) });
  const skip = el('button', { className: 'skip', text: 'Start now' });
  skip.type = 'button';

  clear(stage);
  stage.appendChild(
    el('div', {
      className: 'up-next',
      children: [
        item.startsNewSet
          ? el('p', {
              className: 'break-note',
              text: `Take a moment — set ${item.setIndex + 1} of ${sets} is next.`,
            })
          : null,
        el('div', { className: 'up-next-icon', text: game.icon }),
        el('h2', { className: 'up-next-name', text: game.name }),
        el('p', { className: 'up-next-blurb', text: game.blurb }),
        counter,
        el('p', { className: 'up-next-progress', text: `Game ${item.overallIndex + 1} of ${total}` }),
        skip,
      ],
    }),
  );

  await Promise.race([tick(counter, seconds, signal), tapped(skip, signal)]);
}

async function tick(counter: HTMLElement, seconds: number, signal: AbortSignal): Promise<void> {
  for (let left = seconds; left > 0; left--) {
    counter.textContent = String(left);
    await wait(1000, signal);
    if (signal.aborted) return;
  }
}

function tapped(node: HTMLElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    node.addEventListener('click', () => resolve(), { once: true, signal });
  });
}

async function showAllDone(
  stage: HTMLElement,
  summary: SessionSummary,
  signal: AbortSignal,
): Promise<void> {
  clear(stage);
  stage.appendChild(
    el('div', {
      className: 'all-done',
      children: [
        el('div', { className: 'all-done-icon', text: '🌟' }),
        el('h2', { className: 'all-done-title', text: 'All done' }),
        el('p', {
          className: 'all-done-note',
          text:
            summary.planned === 1
              ? 'That was the game. Nicely done.'
              : `That was all ${summary.planned} games. Nicely done.`,
        }),
      ],
    }),
  );
  await wait(6000, signal);
}

/**
 * Leaving takes a deliberate press and hold. A single stray tap during a game
 * must never end the session — but the caregiver still needs a way out.
 */
function buildExitControl(onExit: () => void, signal: AbortSignal): HTMLElement {
  const fill = el('span', { className: 'exit-fill' });
  const control = button({
    className: 'exit',
    label: 'Hold to end the session',
    children: [fill, el('span', { className: 'exit-glyph', text: '✕' })],
    onTap: () => {},
    signal,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const begin = (): void => {
    control.classList.add('is-holding');
    timer = setTimeout(onExit, HOLD_TO_EXIT_MS);
  };
  const cancel = (): void => {
    control.classList.remove('is-holding');
    clearTimeout(timer);
  };

  for (const event of ['pointerdown'] as const) {
    control.addEventListener(event, begin, { signal });
  }
  for (const event of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    control.addEventListener(event, cancel, { signal });
  }
  return control;
}
