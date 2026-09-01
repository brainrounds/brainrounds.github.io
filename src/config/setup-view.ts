import { GAMES, getGame } from '../games/registry';
import { PACES, type Pace } from '../games/types';
import { button, clear, el } from '../ui/dom';
import {
  MAX_QUEUE,
  MAX_SETS,
  MIN_SETS,
  decodeSetupCode,
  encodeSetupCode,
  requestPersistentStorage,
  saveConfig,
  type Config,
} from './config';
import { describeLastSession, loadLastSession } from './last-session';

const PACE_LABELS: Record<Pace, string> = {
  gentle: 'Gentle',
  steady: 'Steady',
  brisk: 'Brisk',
};

/** Rough seconds a game takes at each pace, for the "about N minutes" estimate. */
const SECONDS_PER_GAME: Record<Pace, number> = { gentle: 95, steady: 78, brisk: 62 };
const INTERSTITIAL_SECONDS = 4;

export interface SetupActions {
  onStart(config: Config): void;
  onPreview(gameId: string, pace: Pace): void;
}

/**
 * The caregiver's screen. Everything that shapes a session is set here, once,
 * so that nothing has to be decided while it is running.
 */
export function renderSetup(root: HTMLElement, config: Config, actions: SetupActions): void {
  let draft: Config = { ...config, queue: config.queue.slice() };

  const update = (next: Partial<Config>): void => {
    draft = { ...draft, ...next };
    saveConfig(draft);
    draw();
  };

  function draw(): void {
    clear(root);
    root.appendChild(
      el('div', {
        className: 'setup',
        children: [
          buildHeader(),
          buildQueue(draft, update, actions),
          buildSets(draft, update),
          buildStart(draft, actions),
          buildLibrary(draft, update, actions),
          buildTransfer(draft, update),
        ],
      }),
    );
  }

  draw();
  void requestPersistentStorage();
}

function buildHeader(): HTMLElement {
  return el('header', {
    className: 'setup-header',
    children: [
      el('h1', { className: 'setup-title', text: 'Brain Rounds' }),
      el('p', { className: 'setup-sub', text: 'Set the games once. Press start. Walk away.' }),
      el('p', { className: 'setup-last', text: describeLastSession(loadLastSession()) }),
    ],
  });
}

function buildQueue(
  config: Config,
  update: (next: Partial<Config>) => void,
  actions: SetupActions,
): HTMLElement {
  const move = (from: number, to: number): void => {
    if (to < 0 || to >= config.queue.length) return;
    const queue = config.queue.slice();
    [queue[from], queue[to]] = [queue[to], queue[from]];
    update({ queue });
  };

  const rows = config.queue.map((entry, index) => {
    const game = getGame(entry.gameId);
    if (!game) return null;

    const paceSelect = el('select', { className: 'pace-select', label: `Pace for ${game.name}` });
    for (const pace of PACES) {
      const option = el('option', { text: PACE_LABELS[pace] });
      option.value = pace;
      option.selected = pace === entry.pace;
      paceSelect.appendChild(option);
    }
    paceSelect.addEventListener('change', () => {
      const queue = config.queue.slice();
      queue[index] = { ...entry, pace: paceSelect.value as Pace };
      update({ queue });
    });

    return el('li', {
      className: 'queue-row',
      children: [
        el('span', { className: 'queue-number', text: String(index + 1) }),
        el('span', { className: 'queue-icon', text: game.icon }),
        el('span', {
          className: 'queue-name',
          children: [
            el('strong', { text: game.name }),
            el('small', { text: game.category }),
          ],
        }),
        paceSelect,
        iconButton('↑', `Move ${game.name} earlier`, () => move(index, index - 1)),
        iconButton('↓', `Move ${game.name} later`, () => move(index, index + 1)),
        iconButton('✕', `Remove ${game.name}`, () =>
          update({ queue: config.queue.filter((_, i) => i !== index) }),
        ),
        iconButton('▶', `Try ${game.name}`, () => actions.onPreview(entry.gameId, entry.pace)),
      ],
    });
  });

  const list = el('ol', { className: 'queue', children: rows });
  const empty = el('p', {
    className: 'empty-note',
    text: 'No games chosen yet — add some from the list below.',
  });

  return el('section', {
    className: 'panel',
    children: [
      el('h2', { className: 'panel-title', text: 'Your session' }),
      config.queue.length === 0 ? empty : list,
    ],
  });
}

function buildSets(config: Config, update: (next: Partial<Config>) => void): HTMLElement {
  const options = [];
  for (let count = MIN_SETS; count <= MAX_SETS; count++) {
    const value = count;
    options.push(
      button({
        className: `set-option${config.sets === value ? ' is-on' : ''}`,
        text: String(value),
        label: `${value} ${value === 1 ? 'set' : 'sets'}`,
        onTap: () => update({ sets: value }),
      }),
    );
  }

  return el('section', {
    className: 'panel',
    children: [
      el('h2', { className: 'panel-title', text: 'How many times through?' }),
      el('p', { className: 'panel-note', text: 'The whole list is played this many times.' }),
      el('div', { className: 'set-options', children: options }),
    ],
  });
}

function buildStart(config: Config, actions: SetupActions): HTMLElement {
  const total = config.queue.length * config.sets;
  const start = button({
    className: 'start',
    text: 'Start session',
    onTap: () => actions.onStart(config),
  });
  start.disabled = config.queue.length === 0;

  return el('section', {
    className: 'panel panel-start',
    children: [
      start,
      el('p', {
        className: 'start-note',
        text:
          total === 0
            ? 'Add at least one game to start.'
            : `${total} games, about ${estimateMinutes(config)} minutes. Nothing to tap until it finishes.`,
      }),
    ],
  });
}

export function estimateMinutes(config: Config): number {
  const seconds = config.queue.reduce(
    (total, entry) => total + SECONDS_PER_GAME[entry.pace] + INTERSTITIAL_SECONDS,
    0,
  );
  return Math.max(1, Math.round((seconds * config.sets) / 60));
}

function buildLibrary(
  config: Config,
  update: (next: Partial<Config>) => void,
  actions: SetupActions,
): HTMLElement {
  const full = config.queue.length >= MAX_QUEUE;
  const cards = GAMES.map((game) =>
    el('div', {
      className: 'game-card',
      children: [
        el('span', { className: 'game-card-icon', text: game.icon }),
        el('strong', { className: 'game-card-name', text: game.name }),
        el('small', { className: 'game-card-cat', text: game.category }),
        el('p', { className: 'game-card-blurb', text: game.blurb }),
        el('div', {
          className: 'game-card-actions',
          children: [
            addButton(game.id, full, () =>
              update({ queue: [...config.queue, { gameId: game.id, pace: 'steady' }] }),
            ),
            iconButton('▶ Try', `Try ${game.name}`, () => actions.onPreview(game.id, 'steady')),
          ],
        }),
      ],
    }),
  );

  return el('section', {
    className: 'panel',
    children: [
      el('h2', { className: 'panel-title', text: 'All games' }),
      el('p', {
        className: 'panel-note',
        text: 'Add the ones that suit. A game can be added more than once.',
      }),
      el('div', { className: 'library', children: cards }),
    ],
  });
}

function addButton(gameId: string, full: boolean, onTap: () => void): HTMLButtonElement {
  const node = button({
    className: 'add',
    text: full ? 'List full' : '+ Add',
    label: `Add ${gameId}`,
    onTap,
  });
  node.disabled = full;
  return node;
}

/**
 * Copy the setup somewhere safe, or move it to another tablet. A browser can
 * clear its stored data, and rebuilding a carefully ordered list from memory
 * is exactly the chore this app exists to remove.
 */
function buildTransfer(config: Config, update: (next: Partial<Config>) => void): HTMLElement {
  const field = el('textarea', { className: 'code-field', label: 'Setup code' });
  field.rows = 3;
  field.value = encodeSetupCode(config);
  field.spellcheck = false;

  const status = el('p', { className: 'code-status', text: '' });

  const restore = button({
    className: 'secondary',
    text: 'Use this code',
    onTap: () => {
      const restored = decodeSetupCode(field.value, GAMES.map((game) => game.id));
      if (!restored) {
        status.textContent = 'That code was not recognised. Nothing has been changed.';
        return;
      }
      update(restored);
    },
  });

  const copy = button({
    className: 'secondary',
    text: 'Copy',
    onTap: () => {
      field.select();
      void navigator.clipboard?.writeText(field.value).catch(() => {
        status.textContent = 'Copy the highlighted code by hand.';
      });
      status.textContent = 'Copied.';
    },
  });

  return el('section', {
    className: 'panel panel-quiet',
    children: [
      el('h2', { className: 'panel-title', text: 'Save or move this setup' }),
      el('p', {
        className: 'panel-note',
        text: 'Keep this code somewhere safe. Pasting it here rebuilds the whole list.',
      }),
      field,
      el('div', { className: 'code-actions', children: [copy, restore] }),
      status,
    ],
  });
}

function iconButton(glyph: string, label: string, onTap: () => void): HTMLButtonElement {
  return button({
    className: 'icon-button',
    text: glyph,
    label,
    onTap,
  });
}
