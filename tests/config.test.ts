import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PACE,
  DEFAULT_SETS,
  MAX_QUEUE,
  MAX_SETS,
  clampSets,
  decodeSetupCode,
  defaultConfig,
  encodeSetupCode,
  loadConfig,
  saveConfig,
  validateConfig,
  type Config,
} from '../src/config/config';
import { describeLastSession, loadLastSession, saveLastSession } from '../src/config/last-session';

const KNOWN = ['speed-sort', 'grid-recall', 'quick-maths'];

beforeEach(() => {
  localStorage.clear();
});

describe('defaultConfig', () => {
  it('starts with every game, at the middle pace, twice through', () => {
    const config = defaultConfig(KNOWN);

    expect(config.queue.map((entry) => entry.gameId)).toEqual(KNOWN);
    expect(config.queue.every((entry) => entry.pace === DEFAULT_PACE)).toBe(true);
    expect(config.sets).toBe(2);
  });
});

describe('validateConfig', () => {
  it('keeps the queue order and the pace of each entry', () => {
    const config = validateConfig(
      { queue: [{ gameId: 'grid-recall', pace: 'gentle' }, { gameId: 'speed-sort', pace: 'brisk' }], sets: 3 },
      KNOWN,
    );

    expect(config?.queue).toEqual([
      { gameId: 'grid-recall', pace: 'gentle' },
      { gameId: 'speed-sort', pace: 'brisk' },
    ]);
    expect(config?.sets).toBe(3);
  });

  it('drops a game that no longer exists but keeps the rest of the queue', () => {
    const config = validateConfig(
      {
        queue: [
          { gameId: 'speed-sort', pace: 'steady' },
          { gameId: 'game-that-was-removed', pace: 'steady' },
          { gameId: 'quick-maths', pace: 'steady' },
        ],
        sets: 2,
      },
      KNOWN,
    );

    expect(config?.queue.map((entry) => entry.gameId)).toEqual(['speed-sort', 'quick-maths']);
  });

  it('falls back to the middle pace when the saved pace is nonsense', () => {
    const config = validateConfig({ queue: [{ gameId: 'speed-sort', pace: 'turbo' }], sets: 2 }, KNOWN);

    expect(config?.queue[0].pace).toBe(DEFAULT_PACE);
  });

  it('clamps the number of sets into range', () => {
    expect(clampSets(0)).toBe(1);
    expect(clampSets(99)).toBe(MAX_SETS);
    expect(clampSets('3')).toBe(3);
    expect(clampSets(3)).toBe(3);
  });

  it('falls back to the default when there is no set count at all', () => {
    // Number() turns all of these into 0, which would silently mean one set.
    expect(clampSets(null)).toBe(DEFAULT_SETS);
    expect(clampSets(undefined)).toBe(DEFAULT_SETS);
    expect(clampSets('')).toBe(DEFAULT_SETS);
    expect(clampSets(false)).toBe(DEFAULT_SETS);
    expect(clampSets('nonsense')).toBe(DEFAULT_SETS);
    expect(clampSets(Number.NaN)).toBe(DEFAULT_SETS);
  });

  it('caps a queue long enough to produce a multi-hour session', () => {
    const huge = Array.from({ length: 200 }, () => ({ gameId: 'speed-sort', pace: 'steady' }));

    expect(validateConfig({ queue: huge, sets: 1 }, KNOWN)?.queue).toHaveLength(MAX_QUEUE);
  });

  it('rejects something that is not a config at all', () => {
    expect(validateConfig(null, KNOWN)).toBeNull();
    expect(validateConfig('a string', KNOWN)).toBeNull();
    expect(validateConfig([1, 2, 3], KNOWN)).toBeNull();
  });

  it('survives a queue full of junk without throwing', () => {
    const config = validateConfig({ queue: [null, 7, 'x', {}, { gameId: 'speed-sort' }], sets: 2 }, KNOWN);

    expect(config?.queue).toEqual([{ gameId: 'speed-sort', pace: DEFAULT_PACE }]);
  });
});

describe('saving and loading', () => {
  it('round-trips a queue the caregiver built', () => {
    const config: Config = {
      version: 1,
      queue: [{ gameId: 'quick-maths', pace: 'gentle' }, { gameId: 'speed-sort', pace: 'brisk' }],
      sets: 4,
    };

    saveConfig(config);

    expect(loadConfig(KNOWN)).toEqual(config);
  });

  it('falls back to the defaults rather than white-screening on corrupt storage', () => {
    localStorage.setItem('brain-rounds.config.v1', '{ this is not json');

    expect(loadConfig(KNOWN)).toEqual(defaultConfig(KNOWN));
  });

  it('falls back to the defaults when every saved game has disappeared', () => {
    saveConfig({ version: 1, queue: [{ gameId: 'long-gone', pace: 'steady' }], sets: 2 });

    expect(loadConfig(KNOWN)).toEqual(defaultConfig(KNOWN));
  });

  it('uses the defaults on a first run with nothing saved', () => {
    expect(loadConfig(KNOWN)).toEqual(defaultConfig(KNOWN));
  });

  it('still returns a usable config when storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
    } as unknown as Storage;

    expect(() => saveConfig(defaultConfig(KNOWN), blocked)).not.toThrow();
    expect(loadConfig(KNOWN, blocked)).toEqual(defaultConfig(KNOWN));
  });
});

describe('setup code', () => {
  it('carries a queue to another tablet unchanged', () => {
    const config: Config = {
      version: 1,
      queue: [{ gameId: 'grid-recall', pace: 'gentle' }, { gameId: 'quick-maths', pace: 'brisk' }],
      sets: 3,
    };

    expect(decodeSetupCode(encodeSetupCode(config), KNOWN)).toEqual(config);
  });

  it('ignores surrounding whitespace from a copy and paste', () => {
    const config = defaultConfig(KNOWN);

    expect(decodeSetupCode(`  ${encodeSetupCode(config)}\n`, KNOWN)).toEqual(config);
  });

  it('rejects a code that is not a code', () => {
    expect(decodeSetupCode('hello there', KNOWN)).toBeNull();
    expect(decodeSetupCode('', KNOWN)).toBeNull();
    expect(decodeSetupCode(btoa('{"not":"a config"}'), KNOWN)).toBeNull();
  });

  it('rejects a code whose games are all unknown, rather than wiping the queue', () => {
    const foreign = btoa(JSON.stringify({ q: [{ gameId: 'nope', pace: 'steady' }], s: 2 }));

    expect(decodeSetupCode(foreign, KNOWN)).toBeNull();
  });
});

describe('last session record', () => {
  it('round-trips and reads back in plain English', () => {
    saveLastSession({
      finishedAt: '2026-09-01T10:00:00.000Z',
      gamesPlayed: 22,
      gamesPlanned: 22,
      minutes: 18,
      completed: true,
    });

    const record = loadLastSession();
    expect(record?.gamesPlayed).toBe(22);
    expect(describeLastSession(record)).toContain('finished all 22 games');
    expect(describeLastSession(record)).toContain('18 minutes');
  });

  it('says so when a session was stopped early', () => {
    const text = describeLastSession({
      finishedAt: '2026-09-01T10:00:00.000Z',
      gamesPlayed: 7,
      gamesPlanned: 22,
      minutes: 6,
      completed: false,
    });

    expect(text).toContain('stopped after 7 of 22 games');
  });

  it('handles a first run with no sessions yet', () => {
    expect(loadLastSession()).toBeNull();
    expect(describeLastSession(null)).toBe('No sessions yet.');
  });

  it('ignores a corrupt record instead of throwing', () => {
    localStorage.setItem('brain-rounds.last-session.v1', '{"garbage":true}');

    expect(loadLastSession()).toBeNull();
  });
});
