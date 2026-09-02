import { getStorage } from './storage';

const STORAGE_KEY = 'brain-rounds.last-session.v1';

export interface LastSession {
  /** ISO date-time the session finished. */
  finishedAt: string;
  gamesPlayed: number;
  gamesPlanned: number;
  minutes: number;
  completed: boolean;
}

/**
 * One record, not a history. It answers the only question the caregiver
 * actually has after leaving the room: did the session run?
 */
export function saveLastSession(record: LastSession, store = getStorage()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A missing record is cosmetic; never let it interrupt the app.
  }
}

export function loadLastSession(store = getStorage()): LastSession | null {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isLastSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function describeLastSession(record: LastSession | null): string {
  if (!record) return 'No sessions yet.';
  const when = new Date(record.finishedAt);
  const day = Number.isNaN(when.getTime()) ? 'recently' : when.toLocaleDateString();
  const status = record.completed
    ? `finished all ${record.gamesPlanned} games`
    : `stopped after ${record.gamesPlayed} of ${record.gamesPlanned} games`;
  return `Last session: ${day} — ${status}, about ${record.minutes} minutes.`;
}

function isLastSession(value: unknown): value is LastSession {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.finishedAt === 'string' &&
    typeof record.gamesPlayed === 'number' &&
    typeof record.gamesPlanned === 'number' &&
    typeof record.minutes === 'number' &&
    typeof record.completed === 'boolean'
  );
}
