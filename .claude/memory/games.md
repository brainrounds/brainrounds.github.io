# Games

Twelve games, one file each in `src/games/`, all registered in
[registry.ts](../../src/games/registry.ts) — the single source of truth the setup screen,
the config validator and the runner all read.

## Anatomy of a game file

```ts
export const PACE_TABLE: PaceTable = {
  gentle: { rounds: 8, answerMs: 6000, showMs: 1800 },
  steady: { rounds: 12, answerMs: 4000, showMs: 1300 },
  brisk:  { rounds: 16, answerMs: 2600, showMs: 900 },
};

export function makeRound(rng: Rng = defaultRng) { … }   // pure, exported, unit-tested
export function isCorrect(round, answer): boolean { … }  // pure, exported, unit-tested

export const myGame: Game = {
  id, name, category, blurb, icon,
  play: (container, opts) => playRounds(container, opts, {
    spec: PACE_TABLE[opts.pace],
    prompt: 'One short sentence.',
    playRound: async (view, round) => { /* render, await an answer, return correct? */ },
  }),
};
```

`playRounds` ([round-runner.ts](../../src/ui/round-runner.ts)) owns the round loop, the
progress pips, the feedback beat and cleanup. A game only supplies "draw a round, return
whether it was right".

## Getting input

All three helpers in [ask.ts](../../src/ui/ask.ts) resolve on the pace's answer window as
well as on a tap, which is what guarantees a round always ends.

| Helper | Returns | Use for |
|--------|---------|---------|
| `tapOne(view, targets)` | index tapped, or `null` on timeout | Pick one of N |
| `tapMany(view, targets, count, opts)` | indexes in tap order (short on timeout) | Pick or repeat a set |
| `askButtons(view, labels)` | index tapped, or `null` | Yes/No, Same/Different, two sums |

**`tapMany` blocks repeat taps unless you pass `{ allowRepeats: true }`.** Sequence games
need it — otherwise an answer like 1-3-1 can never be entered. Set games (Grid Recall) want
the default, where a double-tap can't waste a pick.

## Pace

One knob, three settings. `rounds` is a hard cap, `answerMs` is the per-round window,
`showMs` is how long a stimulus displays. Keep the worst case (`rounds × (answerMs +
showMs + 550ms feedback)`) **under about two minutes** — the runner's watchdog is three
minutes, and it should only ever fire on a genuine fault.

Card Pairs is the deliberate exception: one board *is* one round, so its `answerMs` is the
time allowed for a whole board (35–60 s) and its `rounds` is 2–3.

## Rules a game must not break

- **`play()` always resolves.** Never `await` a bare tap.
- **Every listener uses `{ signal: view.signal }`** so it dies with the game.
- **Correctness comes from the data that was rendered**, not a second computation.
- **A "different" option must be forced to differ.** Leaving it to chance produces rounds
  where the expected answer is wrong — see `makeNextCard` (Speed Sort), `makePanels` (Same
  or Different) and `makeOddGrid` (Odd One Out), which all exclude the current value rather
  than re-rolling and hoping.
- **Movement the player tracks must be animated, not reordered.** Follow the Cup originally
  swapped DOM positions of identical cups, so nothing visibly moved. It now animates
  `transform: translateX()` per slot, and the ball is tracked by cup identity so the answer
  cannot drift from what was shown.

## Shared vocabulary

[palette.ts](../../src/games/palette.ts) holds the five colours and six shape glyphs every
game draws from. Colours are chosen so no red/green pair carries meaning alone. Glyphs
rather than images: crisp at any density, scale with type size, nothing to download.

## Testing a game

Test the pure functions, not the DOM. Use `seededRng` and run each generator over many
seeds — [game-logic.test.ts](../../tests/game-logic.test.ts) uses 50–400 per property.
Assert the invariant, not a specific output: "exactly one item differs", "never two sums
with the same total", "every row and column holds each shape once".
