# The session

Turning a saved queue into a session that plays itself. This is the product; the games are
just content.

## The chain

[playlist.ts](../../src/session/playlist.ts) flattens the config into a flat ordered list
(queue repeated once per set) → [runner.ts](../../src/session/runner.ts) plays it →
[session-view.ts](../../src/session/session-view.ts) draws the shell around it.

A `PlayItem` carries `setIndex`, `positionInSet`, `overallIndex` and `startsNewSet`, so the
view can say "Game 4 of 22" and show a longer breather at each set boundary without
recomputing anything.

Queue entries are `{ gameId, pace }` pairs, not a set of ids — so the same game may appear
more than once, at different paces, and the queue is not fixed to any length.

## Auto-advance is four lines

```ts
for (const item of items) {
  if (deps.signal.aborted) break;
  await deps.announce(item, items.length);   // the "up next" card, which counts itself down
  outcomes.push(await playOne(item, deps));  // resolves when the game ends, however it ends
}
```

That is the whole feature. Everything else protects it.

## Nothing may stall the queue

`playOne` handles four outcomes, and **only one of them is the game behaving**:

| Status | Cause | Handling |
|--------|-------|----------|
| `played` | Normal | Record the result |
| `error` | The game threw | Caught, recorded, session continues |
| `timeout` | The game never resolved | Watchdog wins the race, session continues |
| `missing` | Game id no longer in the registry | Skipped, session continues |

The watchdog **races** `play()` rather than only aborting the signal, because a game that
ignores its signal would otherwise hang the `await` forever. Aborting is the polite ask;
racing is the guarantee.

Each game gets its own `AbortController`, so ending one game never ends the session, while
ending the session still cancels the game in flight. Aborts carry a reason —
`session-ended`, `watchdog`, `game-over` — which is what lets the tests prove *which* path
stopped a game, and what makes a bug report legible.

## Keeping the tablet with you

| Concern | Where | Note |
|---------|-------|------|
| Screen sleeping mid-session | [wake-lock.ts](../../src/session/wake-lock.ts) | Feature-detected; re-acquired on `visibilitychange` because Android drops it when backgrounded |
| Timers running while nobody's looking | `wait()` in [async.ts](../../src/util/async.ts) | Counts only visible time — fixed at the root so every game inherits it |
| Pull-to-refresh reloading the page | `overscroll-behavior: none` | The most dangerous stray gesture: it destroys the session outright |
| Zoom, text selection, context menu | `touch-action`, `user-select`, `main.ts` | All disabled during play |
| A stray tap ending the session | `buildExitControl` | Requires a 2-second `pointerdown` hold |

The wake lock is best-effort by design — if the browser refuses it, the session still runs
and the README tells the caregiver to raise the tablet's own screen timeout.

## Screens

`showUpNext` renders the game's icon, name, blurb, a countdown and "Game N of M". It races
the countdown against a "Start now" tap, so it always ends on its own. A set boundary uses
the same component with a longer countdown and an extra line of text — it is not a separate
screen.

`showAllDone` closes the session, and the last-session record is written by `main.ts` after
`runSessionScreen` resolves.

A **preview** ("▶ Try") is just `runSessionScreen` with a one-game, one-set config, so what
the caregiver samples is exactly what the player gets.

## Testing

[runner.test.ts](../../tests/runner.test.ts) uses fake games to cover the four outcomes,
sets, early exit and cleanup. [session-integration.test.ts](../../tests/session-integration.test.ts)
runs **real** games on fake timers and dispatches **no clicks at all** — including the
poster's actual routine of eleven games twice. If a game ever needs a tap to finish, those
tests fail. That is the point of them.
