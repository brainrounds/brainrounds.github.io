/**
 * Sleep for `ms` of time the player was actually looking at the screen.
 *
 * Every game's timing and every countdown runs through here, so pausing it
 * while the app is hidden pauses the whole session at the root. Without that,
 * putting the tablet down mid-game burns through rounds nobody is playing —
 * and the browser throttles background timers anyway, which would make the
 * remaining time wrong in the other direction.
 *
 * Resolves early — never rejects — when `signal` aborts, so callers can simply
 * check `signal.aborted` afterwards instead of wrapping every wait in a
 * try/catch.
 */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const view = typeof document === 'undefined' ? null : document;
    let remaining = ms;
    let startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const resume = (): void => {
      startedAt = Date.now();
      timer = setTimeout(finish, remaining);
    };
    const pause = (): void => {
      clearTimeout(timer);
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
    };
    const onVisibilityChange = (): void => {
      if (view?.hidden) pause();
      else resume();
    };

    function finish(): void {
      clearTimeout(timer);
      view?.removeEventListener('visibilitychange', onVisibilityChange);
      signal?.removeEventListener('abort', finish);
      resolve();
    }

    view?.addEventListener('visibilitychange', onVisibilityChange);
    signal?.addEventListener('abort', finish, { once: true });
    if (view?.hidden) pause();
    else resume();
  });
}

/** A promise that never settles on its own — only when `signal` aborts. */
export function untilAborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

/** A promise with its resolver exposed — for turning a tap into a value. */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Resolve with whatever `work` produces, or with `fallback` if it has not
 * settled within `ms`. The timer is always cleared, so a fast result does not
 * leave a pending timeout behind.
 *
 * This is the session's safety net: a game that hangs — or that ignores its
 * abort signal — can never stall the queue, because the race resolves without
 * it.
 */
export async function raceTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
