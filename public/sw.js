/* Forgefy service worker.
 *
 * Caching strategy:
 *  - Navigations: network-first, falling back to the last cached SPA shell so
 *    the app opens offline. Never served from cache when online, so a fresh
 *    deploy's index/shell (and its hashed chunk URLs) always wins — this also
 *    avoids stale-chunk hydration errors.
 *  - Hashed build assets (/assets/) and icons: cache-first; the content hash
 *    in the filename makes them immutable.
 *  - /api/ and /ws/ are never touched.
 */
const VERSION = "v1";
const SHELL_CACHE = `forgefy-shell-${VERSION}`;
const ASSET_CACHE = `forgefy-assets-${VERSION}`;
const SHELL_KEY = "/__shell";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("forgefy-") && n !== SHELL_CACHE && n !== ASSET_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/")) return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
  }
});

async function handleNavigation(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(SHELL_KEY, res.clone());
    return res;
  } catch {
    const cached = await cache.match(SHELL_KEY);
    if (cached) return cached;
    return new Response("You are offline and the app has not been cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
