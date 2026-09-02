export const CATEGORIES = [
  'Speed',
  'Memory',
  'Attention',
  'Flexibility',
  'Problem Solving',
  'Math',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PACES = ['gentle', 'steady', 'brisk'] as const;

export type Pace = (typeof PACES)[number];

export interface PlayOptions {
  /** How fast and how long this game runs. The single difficulty knob. */
  pace: Pace;
  /**
   * Aborted when the session ends early or the runner's watchdog fires.
   * Every listener and timer a game creates must be tied to this signal, so
   * cleanup is structural rather than something each game has to remember.
   */
  signal: AbortSignal;
}

export interface GameResult {
  correct: number;
  rounds: number;
}

/**
 * The one contract in the app.
 *
 * `play()` resolves when the game is over, for any reason. The session runner
 * awaits that promise and starts the next game — which is all auto-advance
 * actually is. A game must always end itself, on a round cap and a time cap;
 * the runner enforces a watchdog on top so a buggy game still cannot strand
 * a session.
 */
export interface Game {
  id: string;
  name: string;
  category: Category;
  /** One short line, shown on the "up next" screen. No wall of instructions. */
  blurb: string;
  /** A single glyph used as the game's icon. */
  icon: string;
  play(container: HTMLElement, opts: PlayOptions): Promise<GameResult>;
}

/** How many rounds a game runs, and how long each phase lasts, at one pace. */
export interface PaceSpec {
  rounds: number;
  /** How long the player has to answer before the round moves on, in ms. */
  answerMs: number;
  /** How long a stimulus is shown before it has to be recalled, in ms. */
  showMs: number;
}

export type PaceTable = Record<Pace, PaceSpec>;
