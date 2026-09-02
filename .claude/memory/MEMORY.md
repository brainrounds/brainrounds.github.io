# Brain Rounds — memory index

A tablet web app that plays a chosen queue of cognitive games straight through without
anyone driving it. Vanilla TypeScript + Vite, no framework, no runtime dependencies,
deployed as a static PWA to GitHub Pages.

## Quick rules (the ones most often broken)

- `play()` must always resolve — a game that can wait forever stalls the whole session.
- Register every listener and timer against `opts.signal`, or it fires into the next game.
- Use `wait()` for timing, never a bare `setTimeout` — it pauses while the app is hidden.
- No score, no game over, no red X, anywhere the player can see.
- Single taps only. No swipe, drag, long-press or double-tap.

## Topic files

| File | When to load |
|------|--------------|
| [games.md](games.md) | Adding a game, changing a game's rounds/pace, debugging a game that marks answers wrong |
| [session.md](session.md) | Working on the runner, auto-advance, the watchdog, wake lock, interstitials, or hold-to-exit |
| [config-and-storage.md](config-and-storage.md) | Touching the setup screen, saved settings, the setup code, or the last-session record |
| [shipping.md](shipping.md) | Build config, the PWA/service worker, icons, or the GitHub Pages deploy |

Behaviour locked by tests lives in [../../docs/session-contract.md](../../docs/session-contract.md).

## Cross-cutting patterns

- **The `Game` promise is the whole architecture.** Auto-advance is just the runner
  awaiting `play()` and starting the next one. Anything that would make that promise
  unreliable is a bug in the product, not just the code.
- **Trust nothing to police itself.** The runner races every game against a watchdog rather
  than trusting each game's own time cap, because one buggy game must not be able to strand
  a session.
- **Fix timing at the root.** Visibility pausing lives inside `wait()`, so every game and
  countdown inherits it — no game implements pausing itself.
- **Derive the answer from what was shown.** Every game computes correctness from the same
  data it rendered. Recomputing separately is how right answers get marked wrong.
- **Test generators across many seeds.** Pure logic takes an optional `Rng`; the game-logic
  tests run each generator over 50–400 seeds, because one lucky seed proves nothing.
- **Degrade silently, never fatally.** Wake lock, persistent storage, the clipboard and the
  service worker are all feature-detected and wrapped — a missing one costs a nicety, never
  the session.

## Current state

Twelve games across all six categories; 88 tests; verified in Chrome running a full
multi-set session on a single tap, and rendering offline with the server stopped.
