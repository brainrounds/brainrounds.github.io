/*
 * Offline support for Brain Rounds.
 *
 * The page shell is fetched network-first, so a new build is picked up as soon
 * as the tablet is online — a cache-first shell would pin an old version and
 * point it at asset files that no longer exist, leaving a blank screen.
 * Everything else is content-hashed by the build, so a URL's contents never
 * change and cache-first is both safe and fast.
 */

const VERSION = 'brain-rounds-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        // `cache: 'reload'` goes past the browser's own HTTP cache. Without it
        // the install can store whatever stale copy of the page happens to be
        // sitting there, and then serve that stale copy offline for good.
        // One missing file must not fail the whole install.
        Promise.allSettled(
          SHELL.map((path) => cache.add(new Request(path, { cache: 'reload' }))),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
