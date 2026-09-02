# Brain Rounds

**A brain-training session that runs itself.** Pick the games once, press start, and walk
away — the whole list plays through, twice if you like, with nothing to tap in between.

Built for one specific problem: apps like Lumosity have no custom queue, so a caregiver has
to sit beside the tablet loading the next game, over and over. If the routine is eleven
games played through twice, that's twenty-two manual loads every session.

This removes that entirely. **One tap at the start, and it runs to the end.**

Free, no account, no ads, nothing tracked, and it works with the internet off.

---

## Use it

Open it on the tablet:

**<https://brainrounds.github.io/>**

### Put it on the home screen (Android)

1. Open the link above in **Chrome** on the tablet.
2. Tap the **⋮** menu → **Add to Home screen** → **Install**.
3. Open it from the new icon. It runs fullscreen, like a normal app, and works offline
   after the first visit.

### Stop the screen going to sleep

The app asks the tablet to keep the screen awake during a session, but not every tablet
allows it. If the screen dims mid-session, raise the timeout too:

**Settings → Display → Screen timeout → 10 minutes** (or the longest available).

### Set up a session

1. In **Your session**, remove any games that don't suit, and use **↑ ↓** to put the rest
   in the order you want.
2. Set each game's pace — **Gentle**, **Steady** or **Brisk**. Gentle gives more time and
   fewer rounds. You can add the same game twice at different paces.
3. Choose **how many times through** — 2 plays the whole list twice.
4. Tap **▶ Try** on any game to play just that one, so you can check it suits before it
   goes into a real session.
5. Press **Start session**.

That's the last tap needed. Each game ends on its own, a short "up next" card counts down,
and the next one begins.

### Two things worth knowing

- **Copy your setup code.** At the bottom of the setup screen is a code that rebuilds your
  whole list. Browsers occasionally clear stored data — paste the code back in and
  everything returns in seconds. Keep it in a note or an email to yourself.
- **To stop early, press and hold the ✕** in the top corner for two seconds. It needs a
  deliberate hold so a stray tap during a game can never end the session.

---

## The games

Twelve games covering the six kinds of thinking these programmes usually train. Every one
is single taps only — no swiping, dragging or double-tapping — and every one ends itself.

| Game | Trains | What you do |
|------|--------|-------------|
| Speed Sort | Speed | Does this card match the one before it? |
| Same or Different | Speed | Are the two boxes the same, or different? |
| Grid Recall | Memory | Remember which squares lit up, then tap them |
| Card Pairs | Memory | Turn cards over two at a time and find the pairs |
| Tap Order | Memory | Repeat the order the tiles flashed in |
| Follow the Cup | Attention | Keep your eye on the cup hiding the ball |
| Odd One Out | Attention | One shape is different — tap it |
| Colour Match | Flexibility | Does the bottom word name the top word's *colour*? |
| Arrow Flock | Flexibility | Which way is the *middle* arrow pointing? |
| Pattern Fill | Problem solving | Which shape belongs in the empty square? |
| Size Order | Problem solving | Tap the circles smallest to largest |
| Quick Maths | Math | Which sum comes to the bigger number? |

### Designed for a player who finds screens hard

- **No score, no game over, no red X.** A right answer gets a tick, a wrong one gets a
  neutral dot, and it moves on. Nothing in the app tells anyone they failed.
- **Single taps only** — never a swipe, drag, long-press or double-tap.
- **Large text, large targets, high contrast**, and no decorative clutter.
- **Nothing can strand a session.** Every game ends on a round limit *and* a time limit,
  and the app force-advances past any game that stops responding.
- **Stray gestures are blocked** — pull-to-refresh, pinch-zoom and the long-press menu are
  all disabled, so the session can't be knocked off course by accident.

---

## Privacy

Everything stays on the tablet. There is no account, no server, no analytics and no network
request after the page loads. Your setup lives in the browser's own storage.

---

## For developers

```bash
npm install     # no runtime dependencies; Vite, TypeScript and Vitest only
npm run dev     # local dev server
npm test        # unit and integration tests
npm run build   # static site into dist/
```

The build uses a relative base path, so `dist/` can be served from a domain root, a
sub-path, or any plain static host. `node scripts/build-single-file.mjs` folds the build
into one self-contained HTML file, for handing to someone who has nowhere to host it.

The live site is the contents of `dist/` on the `gh-pages` branch. A GitHub Actions
workflow for the same job is included in [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
if you would rather deploy that way.

- [docs/session-contract.md](docs/session-contract.md) — the behaviour the app must never
  lose, and the test holding each rule in place.
- [CLAUDE.md](CLAUDE.md) — rules for working in this repo.

### Adding a game

Implement the `Game` interface in [src/games/types.ts](src/games/types.ts), add one file to
`src/games/`, and register it in [src/games/registry.ts](src/games/registry.ts). The
`playRounds` helper handles the round loop, timing, feedback and cleanup, so a new game is
usually a pure "make a round / check the answer" pair plus a small render function.

**The one rule that matters:** `play()` must always resolve. A game that can wait forever
on a tap would strand the session, which is the single failure this app exists to prevent.

---

## Licence

MIT — see [LICENSE](LICENSE).
