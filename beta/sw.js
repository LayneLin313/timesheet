/* 工時記錄 service worker
 *
 * 更新方式 / How to ship an update:
 *   1. Change any site file.
 *   2. Bump VERSION below (e.g. 'v1' -> 'v2'). Without a byte change in sw.js the
 *      browser will not install a new worker, so the old cache keeps being served.
 * The new worker precaches everything into a new cache, calls skipWaiting(), and on
 * activate deletes old caches and claims clients. index.html listens for
 * 'controllerchange' and reloads once, so open tabs switch to the new version.
 * localStorage (beta app data, keys 'worklog.beta.*') is never touched by this worker.
 */
const VERSION = 'v8';
// beta (/timesheet/beta/): own cache prefix so it never collides with or deletes the production timesheet-* caches
const CACHE_PREFIX = 'worklog-beta-';
const CACHE = `${CACHE_PREFIX}${VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/supabase.js',
  './app/config.js',
  './app/sync-core.js',
  './app/sdk-shim.js',
  './app/worklog-plugin.js',
  './app/io.js',
  './app/main.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' bypasses the HTTP cache so a bumped VERSION gets fresh files.
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Supabase auth/REST: always network, never cached (already cross-origin; explicit in case of a custom domain proxy)
  if (/\.supabase\.(co|in)$/.test(url.hostname)) return;

  // Page navigations: serve the cached app shell (works offline, also for ./?query).
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { cacheName: CACHE })
        .then((cached) => cached || fetch(req))
        .catch(() => caches.match('./index.html', { cacheName: CACHE }))
    );
    return;
  }

  // Static assets: cache-first, fall back to network (and cache same-origin successes).
  event.respondWith(
    caches.match(req, { cacheName: CACHE }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
