# Brain Rounds — project rules

A tablet web app that plays a caregiver-chosen queue of cognitive games straight through,
so nobody has to sit and load the next one. The player has cognitive decline; the caregiver
is not technical. Both facts drive every rule below.

## The one invariant everything serves

**NEVER let a session stall.** A stalled queue puts the caregiver back in front of the
screen, which is the entire problem this app exists to remove. Every rule about timeouts,
watchdogs, wake locks and gestures is downstream of this.

## Architectural rules

- **NEVER write a game that can wait forever.** `play()` must always resolve. Take input
  only through `tapOne` / `tapMany` / `askButtons` in [src/ui/ask.ts](src/ui/ask.ts) — they
  all resolve on a timeout as well as a tap.
- **ALWAYS register listeners and timers against `opts.signal`.** A leaked listener fires
  into the *next* game's DOM. `addEventListener(..., { signal })` and the `wait()` helper
  both take it.
- **NEVER add a runtime dependency.** The target is an old Android tablet; the whole bundle
  is ~30 kB. Dev dependencies are Vite, TypeScript and Vitest, and that is the whole list.
- **NEVER use canvas.** Every game is DOM and CSS — crisp at any density, accessible for
  free, and far less code.
- **ALWAYS use `wait()` from [src/util/async.ts](src/util/async.ts) for timing**, never a
  bare `setTimeout`. It counts only time the app was visible, which is what pauses a
  session when the tablet is put down. The one deliberate exception is the runner's
  watchdog, which must fire in real time.
- **NEVER set `innerHTML`.** Build elements with `el()` in [src/ui/dom.ts](src/ui/dom.ts);
  it always uses `textContent`.

## Rules for the player-facing UI

- **NEVER show a score, a game over, or a red X.** Right gets a tick, wrong gets a neutral
  dot, and the round moves on. This is not a style preference — the app is used by someone
  with dementia.
- **NEVER require a gesture other than a single tap.** No swipe, drag, long-press or
  double-tap, anywhere in a game.
- **ALWAYS keep touch targets at 72 px and body text at 20 px minimum** (`--tap`, `--text`
  in [src/styles.css](src/styles.css)).
- **NEVER remove the gesture lockdown.** `overscroll-behavior: none` stops pull-to-refresh
  reloading the page mid-session; `touch-action: manipulation` and `user-select: none` stop
  zoom and the selection menu. All three are load-bearing, not cosmetic.

## Conventions

- **One file per game** in `src/games/`, exporting a `PACE_TABLE` and the `Game` object.
- **Pure logic is exported and unit-tested; rendering is not.** Generation and
  answer-checking take an optional `Rng` so tests can run them across many seeds.
- **A "correct" answer must be derived from the same data the player saw.** Recomputing it
  separately is how a game ends up marking a right answer wrong.
- Tests live in `tests/`, named after what they cover, and describe behaviour in plain
  English ("keeps going when a game throws").

## Verification

```bash
npm test          # unit + integration
npm run typecheck # strict, with noUnusedLocals/Parameters
npm run build     # tsc --noEmit && vite build
npm run test:smoke
```

`npm test` must be green before any commit. The integration tests in
[tests/session-integration.test.ts](tests/session-integration.test.ts) run real games on
fake timers and dispatch **no clicks at all** — if a game ever needs a tap to finish, they
fail. Do not weaken that.

## Known traps

- **`Number()` coerces `null`, `''` and `false` to 0.** That once turned a missing set
  count into one set instead of the default two. Parse explicitly — see `clampSets` in
  [src/config/config.ts](src/config/config.ts).
- **A service worker can enshrine a stale page.** Install fetches must pass
  `cache: 'reload'`, or the shell cached for offline use is whatever happened to be in the
  browser's HTTP cache. Observed serving a completely different app.
- **Identical objects can't show movement.** Follow the Cup originally "shuffled" by
  reordering the DOM, which is invisible when every cup looks the same. Movement the player
  must track has to be animated, not reordered.
- **`tapMany` blocks repeat taps by default.** Sequence games need
  `{ allowRepeats: true }`, or an answer like 1-3-1 can never be entered.

## Documentation

Tiered system: CLAUDE.md → [MEMORY.md](.claude/memory/MEMORY.md) → topic files
(`.claude/memory/*.md`). Max 2 hops from cold start.

**Placement rule**: Prevents mistakes on ANY task → CLAUDE.md. Spans features → MEMORY.md.
One feature → topic file.

**Updating docs**: When code changes affect a rule in CLAUDE.md, update CLAUDE.md. When
code changes affect a feature covered by a memory file, update that file. Behaviour locked
by a test belongs in [docs/session-contract.md](docs/session-contract.md).
