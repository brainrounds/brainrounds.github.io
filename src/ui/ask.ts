import { deferred, wait } from '../util/async';
import { el } from './dom';
import type { RoundView } from './round-runner';

/**
 * The longest any single round may wait for an answer. A pace should always
 * set its own window; this is the backstop that guarantees a round ends even
 * if one ever forgets to.
 */
const MAX_ROUND_MS = 30_000;

/**
 * Wait for one tap among `targets` and resolve with its index — or `null` if
 * the answer window runs out first.
 *
 * Nothing in this app ever waits on a tap that may never come. That is what
 * lets a session run unattended.
 */
export function tapOne(view: RoundView, targets: HTMLElement[]): Promise<number | null> {
  const answer = deferred<number | null>();
  let settled = false;

  targets.forEach((target, index) => {
    target.addEventListener(
      'click',
      () => {
        if (settled) return;
        settled = true;
        target.classList.add('is-picked');
        answer.resolve(index);
      },
      { signal: view.signal },
    );
  });

  return Promise.race([answer.promise, endOfWindow(view, () => settled, null)]);
}

export interface TapManyOptions {
  /**
   * Whether the same target may be tapped more than once. Repeating a sequence
   * needs it (1-3-1 is a valid answer); picking a set of squares does not, and
   * blocking a double-tap there saves the player from a wasted pick.
   */
  allowRepeats?: boolean;
}

/**
 * Wait for `count` taps in order and resolve with the indexes tapped. When the
 * window closes it resolves with whatever was tapped so far, so a player who
 * stops halfway still moves on to the next round.
 */
export function tapMany(
  view: RoundView,
  targets: HTMLElement[],
  count: number,
  options: TapManyOptions = {},
): Promise<number[]> {
  const picked: number[] = [];
  const answer = deferred<number[]>();

  targets.forEach((target, index) => {
    target.addEventListener(
      'click',
      () => {
        if (picked.length >= count) return;
        if (!options.allowRepeats && picked.includes(index)) return;
        picked.push(index);
        markPicked(view, target, options.allowRepeats === true);
        if (picked.length === count) answer.resolve(picked.slice());
      },
      { signal: view.signal },
    );
  });

  return Promise.race([
    answer.promise,
    endOfWindow(view, () => picked.length === count, picked),
  ]);
}

/**
 * Show that a tap registered. When repeats are allowed the highlight has to
 * clear again, otherwise tapping the same tile twice would look like nothing
 * happened.
 */
function markPicked(view: RoundView, target: HTMLElement, transient: boolean): void {
  target.classList.add('is-picked');
  if (!transient) {
    target.setAttribute('aria-pressed', 'true');
    return;
  }
  void wait(TAP_FLASH_MS, view.signal).then(() => target.classList.remove('is-picked'));
}

const TAP_FLASH_MS = 180;

/** A row of big labelled buttons; resolves with the index tapped, or `null`. */
export function askButtons(
  view: RoundView,
  labels: string[],
  where?: HTMLElement,
): Promise<number | null> {
  const buttons = labels.map((label) => {
    const node = el('button', { className: 'choice', text: label });
    node.type = 'button';
    return node;
  });
  const row = el('div', { className: 'choice-row', children: buttons });
  (where ?? view.stage).appendChild(row);
  return tapOne(view, buttons);
}

/**
 * Resolve with `value` once the answer window elapses (or the session ends).
 * `isSettled` lets a tap that already landed win the race outright.
 */
function endOfWindow<T>(view: RoundView, isSettled: () => boolean, value: T): Promise<T> {
  const ms = view.answerMs > 0 ? view.answerMs : MAX_ROUND_MS;
  return wait(ms, view.signal).then(() => {
    if (isSettled()) return new Promise<T>(() => {}); // a tap already won; stay pending
    return value;
  });
}
