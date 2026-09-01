import type { GameResult, PaceSpec, PlayOptions } from '../games/types';
import { wait } from '../util/async';
import { clear, el } from './dom';

/** How long the tick/dot feedback shows before the next round starts. */
const FEEDBACK_MS = 550;

export interface RoundView {
  /** The area a game draws into. Cleared between rounds. */
  stage: HTMLElement;
  /** Set the big instruction line above the stage. */
  prompt(text: string): void;
  /** Tie every listener and timer to this, so nothing leaks into the next game. */
  signal: AbortSignal;
  /** Sleep, cut short if the session ends. */
  wait(ms: number): Promise<void>;
  /** How long this pace allows for an answer, in ms. */
  answerMs: number;
  /** How long this pace shows a stimulus before recall, in ms. */
  showMs: number;
}

export interface RoundsSpec {
  spec: PaceSpec;
  /** The instruction line. One short sentence. */
  prompt: string;
  /**
   * Play one round. Resolve `true` if the player got it right. A round must
   * always resolve — use `view.wait` and the answer timeout rather than waiting
   * on a tap that may never come.
   */
  playRound(view: RoundView, round: number): Promise<boolean>;
}

/**
 * The loop every game shares: draw the stage once, run N rounds, show a soft
 * beat of feedback after each, and stop early if the session ends.
 *
 * Feedback is deliberately gentle — a tick for right, a neutral dot for wrong.
 * There is no score, no buzzer and no red cross anywhere in this app.
 */
export async function playRounds(
  container: HTMLElement,
  opts: PlayOptions,
  config: RoundsSpec,
): Promise<GameResult> {
  const promptLine = el('p', { className: 'game-prompt', text: config.prompt });
  const stage = el('div', { className: 'game-stage' });
  const feedback = el('div', { className: 'game-feedback', text: '' });
  const progress = el('div', { className: 'game-progress' });

  clear(container);
  container.appendChild(el('div', {
    className: 'game',
    children: [promptLine, stage, feedback, progress],
  }));

  const view: RoundView = {
    stage,
    prompt: (text) => {
      promptLine.textContent = text;
    },
    signal: opts.signal,
    wait: (ms) => wait(ms, opts.signal),
    answerMs: config.spec.answerMs,
    showMs: config.spec.showMs,
  };

  let correct = 0;
  let played = 0;

  for (let round = 0; round < config.spec.rounds; round++) {
    if (opts.signal.aborted) break;
    renderProgress(progress, round, config.spec.rounds);
    clear(stage);
    feedback.textContent = '';
    feedback.className = 'game-feedback';

    const wasRight = await config.playRound(view, round);
    if (opts.signal.aborted) break;

    played++;
    if (wasRight) correct++;
    feedback.textContent = wasRight ? '✓' : '·';
    feedback.className = `game-feedback ${wasRight ? 'is-right' : 'is-neutral'}`;
    await wait(FEEDBACK_MS, opts.signal);
  }

  return { correct, rounds: played };
}

function renderProgress(node: HTMLElement, round: number, total: number): void {
  clear(node);
  for (let i = 0; i < total; i++) {
    node.appendChild(el('span', { className: `pip${i <= round ? ' is-done' : ''}` }));
  }
}
