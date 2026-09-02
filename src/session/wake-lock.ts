interface WakeLockSentinel {
  release(): Promise<void>;
}

interface WakeLockCapableNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
}

export interface ScreenWakeLock {
  acquire(): Promise<void>;
  release(): Promise<void>;
}

/**
 * Hold the tablet's screen awake for the length of a session.
 *
 * Without this the screen times out while the player is thinking, the tablet
 * locks, and the caregiver comes back to a dark screen and a frozen session —
 * which is exactly the babysitting this app exists to remove.
 *
 * Wake Lock is unavailable on older browsers, so every call is feature-detected
 * and failure is silent: the session still runs, it just relies on the tablet's
 * own screen-timeout setting.
 */
export function createScreenWakeLock(): ScreenWakeLock {
  let sentinel: WakeLockSentinel | null = null;
  let wanted = false;

  async function request(): Promise<void> {
    const api = (navigator as WakeLockCapableNavigator).wakeLock;
    if (!api || sentinel) return;
    try {
      sentinel = await api.request('screen');
    } catch {
      sentinel = null; // denied, or the screen is already off
    }
  }

  // Android drops the lock whenever the app is backgrounded, so take it again
  // as soon as the app is visible.
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') void request();
  });

  return {
    async acquire(): Promise<void> {
      wanted = true;
      await request();
    },
    async release(): Promise<void> {
      wanted = false;
      const held = sentinel;
      sentinel = null;
      try {
        await held?.release();
      } catch {
        // Already gone; nothing to do.
      }
    },
  };
}
