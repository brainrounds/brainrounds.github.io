# Building and shipping

## Build

[vite.config.ts](../../vite.config.ts) sets two things that both matter:

- **`base: './'`** — relative, so `dist/` works from a domain root, a GitHub Pages project
  sub-path, or any static folder. An absolute base is the classic Pages failure: every
  asset 404s because the site is served from `/<repo>/`, not `/`.
- **`target: 'es2017'`** — the tablet is old enough to still be running Lumosity's Android
  app, so don't assume a current engine.

Bundle is roughly 30 kB of JS and 7.5 kB of CSS (about 10 kB gzipped) with zero runtime
dependencies. Keep it that way; the device is the constraint.

## PWA

| File | Role |
|------|------|
| `public/manifest.webmanifest` | `display: fullscreen`, relative `start_url`/`scope`, 192 + 512 icons |
| `public/sw.js` | Offline support |
| `public/icon.svg`, `icon-192.png`, `icon-512.png` | Icons; the PNGs are rendered from the SVG |
| `index.html` | Viewport locked against zoom; theme colour; manifest link |

Registration is relative (`./sw.js`) and skipped in dev, in
[main.ts](../../src/main.ts).

### Two service-worker rules, both learned the hard way

1. **The page shell is network-first, assets are cache-first.** Asset URLs are
   content-hashed so their contents never change — cache-first is safe and fast. The shell
   is not hashed, so caching it first would pin an old build pointing at asset files that
   no longer exist: a blank screen with no way to recover.
2. **Install fetches must pass `cache: 'reload'`.** Without it `cache.add()` can store
   whatever stale copy is sitting in the browser's own HTTP cache and then serve that
   offline forever. This was observed live serving a completely different application's
   page.

Bump `VERSION` in `sw.js` when the shell changes; `activate` deletes every cache that isn't
the current version.

## Deploy

[.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) runs typecheck, tests
and build on every push to `main`, then publishes `dist/` to GitHub Pages. A red test
blocks the deploy.

**Verify the deployed URL, not just localhost.** Base-path and service-worker faults are
invisible locally and obvious in production.

## Local checks

```bash
npm run typecheck   # strict; noUnusedLocals + noUnusedParameters catch dead imports
npm test            # unit + integration, jsdom
npm run test:smoke  # fast "is it on fire" subset
npm run build       # tsc --noEmit && vite build
npm run preview     # serve dist/ exactly as deployed
```

## Environment note (this machine only)

`~/.npmrc` sets `min-release-age`, which makes npm **exit 0 while installing truncated
packages** — the directory exists with a fraction of its files and no `.bin` entry. Install
with:

```bash
npm install --min-release-age=0 --minimum-release-age=0
```

then confirm the binaries actually run (`npx tsc --version`) before believing any build
failure is the repo's fault.
