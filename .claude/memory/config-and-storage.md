# Config, the setup screen and storage

Everything the caregiver decides, and how it survives.

## Shape

```ts
interface Config { version: 1; queue: { gameId: string; pace: Pace }[]; sets: number }
```

Bounds: `sets` 1–5, queue capped at `MAX_QUEUE` (40) so nobody can accidentally build a
multi-hour session. Defaults: every game, `steady`, 2 sets — so a first run works before
anything is configured.

## Losing a queue is the worst outcome

A caregiver who has ordered eleven games and set each pace has done real work. Browsers
clear site data under storage pressure, and a slightly different URL is a different store.
Three defences, in [config.ts](../../src/config/config.ts):

1. **`validateConfig` keeps everything it recognises.** An unknown `gameId` drops that one
   entry; a nonsense pace falls back to the default; corrupt JSON falls back to the
   defaults rather than white-screening. It never discards a queue it could partly rescue.
2. **`requestPersistentStorage()`** asks the browser not to evict the app, called when the
   setup screen opens.
3. **The setup code** — base64 of the queue and set count, shown at the bottom of the setup
   screen with copy and restore. Pasting it back rebuilds the whole list in seconds.

`loadConfig` also falls back to defaults when the stored queue validates to **empty**,
because an empty queue means there is nothing to play at all.

## The `Number()` trap

`clampSets` parses explicitly instead of calling `Number()`, which coerces `null`, `''` and
`false` to `0`. Left alone, a missing set count clamped to the minimum — silently turning a
two-set routine into one. Locked by "falls back to the default when there is no set count
at all" in [config.test.ts](../../tests/config.test.ts).

## The setup screen

[setup-view.ts](../../src/config/setup-view.ts) rebuilds its whole DOM on every change
(`draw()`), which for twelve games is cheap and rules out an entire class of incremental
update bugs. Because the DOM is replaced wholesale, its buttons do **not** need an
`AbortSignal` — unlike anything inside a session.

Sections, in order: header with the last-session line → the ordered queue (reorder, pace,
remove, try) → sets → Start → the full game library (add, try) → the setup code.

`estimateMinutes` is a rough figure from a per-pace constant, deliberately labelled
"about". It does not read the games' pace tables — the estimate is guidance for planning
around a session, not a promise.

**"▶ Try"** matters more than it looks: without it the only way to evaluate twelve games
would be to sit through a whole session, which is exactly the chore the app removes.

## The last-session record

[last-session.ts](../../src/config/last-session.ts) stores **one** record, not a history:
date, games played, games planned, minutes, and whether it completed. It answers the only
question a caregiver has after leaving the room — did it actually run? — and renders as one
line at the top of the setup screen.

Storage failures are swallowed everywhere here. A missing record is cosmetic; it must never
interrupt the app.
