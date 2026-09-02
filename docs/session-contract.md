# Session contract

The behaviour this app must never lose, and the test that holds each rule in place.

The app exists to remove one specific chore: a caregiver sitting beside a tablet
loading the next game, over and over, twice through. Every rule below protects that.

## The `Game` contract

```ts
interface Game {
  id: string; name: string; category: Category; blurb: string; icon: string;
  play(container: HTMLElement, opts: PlayOptions): Promise<GameResult>;
}
```

| # | Invariant | Locked by |
|---|-----------|-----------|
| G1 | `play()` resolves when the game is over, for any reason. The runner awaits it and starts the next game — that promise *is* auto-advance. | `session-integration.test.ts` › "runs every one of the twelve games without any of them stalling" |
| G2 | A game ends itself on a round cap **and** a time cap. It never waits on a tap that may never come. | `session-integration.test.ts` › "plays a queue through both sets with no input at all" |
| G3 | Every listener and timer a game creates is registered against `opts.signal`, so it cannot outlive the game. | `runner.test.ts` › "aborts the running game when the watchdog fires" |
| G4 | Every game is playable with single taps only — no swipe, drag, double-tap or long-press. | Reviewed per game; enforced by only ever using `tapOne` / `tapMany` / `askButtons` |
| G5 | Every game exposes a `PACE_TABLE` with an entry for all three paces. | `smoke.test.ts` › "has a pace entry for every game at every pace" |

## The session runner

| # | Invariant | Locked by |
|---|-----------|-----------|
| S1 | The queue is played once per set, in order, with no input between games. | `runner.test.ts` › "repeats the queue for every set" |
| S2 | A game that **throws** is recorded and skipped; the session continues. | `runner.test.ts` › "keeps going when a game throws" |
| S3 | A game that **hangs** is force-advanced past by the watchdog, even if it ignores its abort signal. | `runner.test.ts` › "force-advances past a game that hangs forever" |
| S4 | A game id no longer in the library is skipped, not fatal. | `runner.test.ts` › "skips a game id that is no longer in the library" |
| S5 | The container is cleared between games, so nothing bleeds through. | `runner.test.ts` › "clears the screen between games" |
| S6 | Ending the session cancels the game in flight, and the reason says which stopped it. | `runner.test.ts` › "cancels the game in flight when the caregiver ends the session" |
| S7 | A queue entry is a `{ gameId, pace }` pair, so a game may appear more than once at different paces. | `playlist.test.ts` › "allows the same game more than once, at different paces" |

**S3 is the one that matters most.** A stalled queue is the single failure that would
put the caregiver back in front of the screen — so the runner never trusts a game to
end itself.

## Keeping a session uninterrupted

| # | Invariant | Why it exists |
|---|-----------|---------------|
| U1 | A screen wake lock is held for the whole session and re-taken when the app becomes visible again. | Without it the tablet screen times out while the player is thinking, and the caregiver returns to a dark screen and a frozen session. |
| U2 | `overscroll-behavior: none` on the body. | A downward drag on Android triggers pull-to-refresh, which reloads the page and destroys the session. |
| U3 | `touch-action: manipulation`, `user-select: none`, and `contextmenu` suppressed. | Stops double-tap zoom and the long-press text-selection menu appearing over a game. |
| U4 | `wait()` counts only time the app was visible. | Every game's timing and every countdown runs through it, so the whole session pauses at the root when the tablet is put down — and browsers throttle background timers anyway. |
| U5 | Leaving mid-session requires a 2-second press-and-hold. | A stray tap must never end a session; the caregiver must always be able to. |

## Configuration

| # | Invariant | Locked by |
|---|-----------|-----------|
| C1 | A saved config survives a restart. | `config.test.ts` › "round-trips a queue the caregiver built" |
| C2 | Corrupt storage falls back to defaults rather than white-screening. | `config.test.ts` › "falls back to the defaults rather than white-screening on corrupt storage" |
| C3 | An unknown game id is dropped; the rest of the queue is kept. | `config.test.ts` › "drops a game that no longer exists but keeps the rest of the queue" |
| C4 | A missing set count falls back to the default, not to the minimum. | `config.test.ts` › "falls back to the default when there is no set count at all" |
| C5 | A setup code round-trips a queue exactly, and an unrecognised code changes nothing. | `config.test.ts` › "setup code" |
| C6 | A browser that refuses access to `localStorage` outright costs the saved setup, never the app. | `storage-blocked.test.ts` › "still renders the whole setup screen" |

C6 exists because reading the `localStorage` property can itself throw, and a default
argument is evaluated before the function body — so the guard has to live outside, in
`getStorage()`. Observed rendering a completely blank app inside a sandboxed frame.

C4 exists because `Number(null)` is `0`: coercing a missing value would quietly turn
two sets into one.

## Deliberate non-goals

- **A session is not resumable across a tablet reboot.** Real complexity for a rare
  event; the last-session record makes it obvious what happened instead.
- **No score is ever shown to the player.** Right and wrong get a tick or a neutral
  dot and the round moves on. There is no game over, no buzzer and no red cross
  anywhere in the app.
- **No accounts, no backend, no analytics.** Nothing leaves the tablet.
