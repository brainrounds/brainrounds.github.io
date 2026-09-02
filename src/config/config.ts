import { PACES, type Pace } from '../games/types';
import { getStorage } from './storage';

const STORAGE_KEY = 'brain-rounds.config.v1';

export const MIN_SETS = 1;
export const MAX_SETS = 5;
/** Two, because that is the routine the app was built for. */
export const DEFAULT_SETS = 2;
/** A guard against a queue long enough to produce a multi-hour session. */
export const MAX_QUEUE = 40;

export const DEFAULT_PACE: Pace = 'steady';

export interface QueueEntry {
  gameId: string;
  pace: Pace;
}

export interface Config {
  version: 1;
  /** Played in this order. A game may appear more than once, at different paces. */
  queue: QueueEntry[];
  /** How many times the whole queue is played. The poster's routine is two. */
  sets: number;
}

export function defaultConfig(gameIds: readonly string[]): Config {
  return {
    version: 1,
    queue: gameIds.slice(0, MAX_QUEUE).map((gameId) => ({ gameId, pace: DEFAULT_PACE })),
    sets: DEFAULT_SETS,
  };
}

/**
 * Turn anything at all into a usable config.
 *
 * Storage can hold a config written by an older version, hand-edited JSON, or
 * plain corruption. Losing a carefully built queue is one of the worst things
 * that could happen to a caregiver, so this keeps every entry it can recognise
 * and silently drops only what it cannot.
 */
export function validateConfig(raw: unknown, knownGameIds: readonly string[]): Config | null {
  if (!isRecord(raw)) return null;

  const known = new Set(knownGameIds);
  const queue = Array.isArray(raw.queue)
    ? raw.queue
        .map((entry) => validateEntry(entry, known))
        .filter((entry): entry is QueueEntry => entry !== null)
        .slice(0, MAX_QUEUE)
    : [];

  return {
    version: 1,
    queue,
    sets: clampSets(raw.sets),
  };
}

function validateEntry(raw: unknown, known: Set<string>): QueueEntry | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.gameId !== 'string' || !known.has(raw.gameId)) return null;
  const pace = PACES.includes(raw.pace as Pace) ? (raw.pace as Pace) : DEFAULT_PACE;
  return { gameId: raw.gameId, pace };
}

/**
 * Read a set count from anything, falling back to the default when there
 * genuinely isn't one.
 *
 * The coercion is spelled out rather than left to `Number()`, which turns
 * `null`, `''` and `false` into 0 — so a missing value would quietly become
 * one set instead of the default two.
 */
export function clampSets(value: unknown): number {
  const parsed = toNumber(value);
  if (parsed === null) return DEFAULT_SETS;
  return Math.min(MAX_SETS, Math.max(MIN_SETS, Math.round(parsed)));
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function loadConfig(gameIds: readonly string[], store = getStorage()): Config {
  let stored: string | null = null;
  try {
    stored = store?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return defaultConfig(gameIds); // private mode, or storage disabled
  }
  if (!stored) return defaultConfig(gameIds);
  const parsed = parseJson(stored);
  const config = parsed === null ? null : validateConfig(parsed, gameIds);
  // An empty queue would leave nothing to play, so fall back rather than strand.
  if (!config || config.queue.length === 0) return defaultConfig(gameIds);
  return config;
}

export function saveConfig(config: Config, store = getStorage()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Nothing useful to do if storage is full or blocked; the session still runs.
  }
}

/** The setup code a caregiver can copy to move or restore a queue. */
export function encodeSetupCode(config: Config): string {
  return btoa(JSON.stringify({ q: config.queue, s: config.sets }));
}

export function decodeSetupCode(code: string, knownGameIds: readonly string[]): Config | null {
  let json: string;
  try {
    json = atob(code.trim());
  } catch {
    return null;
  }
  const parsed = parseJson(json);
  if (!isRecord(parsed)) return null;
  const config = validateConfig({ queue: parsed.q, sets: parsed.s }, knownGameIds);
  return config && config.queue.length > 0 ? config : null;
}

/**
 * Ask the browser not to evict this app's storage. Without it a saved queue
 * can quietly disappear when the tablet is low on space.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
