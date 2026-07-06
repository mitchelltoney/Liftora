/* Liftora service worker — offline-first app shell.
 * Data lives in IndexedDB (already offline); this makes the shell match.
 * All paths derive from the registration scope, so the same worker serves
 * a root deployment ("/") and a project-site deployment ("/Liftora/").
 */
const VERSION = "liftora-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

// "" for root scope, "/Liftora" for a project site.
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");

const SHELL_ROUTES = ["/", "/log", "/history", "/analytics", "/settings"].map(
  (route) => (route === "/" ? `${BASE}/` : `${BASE}${route}`),
);
const PRECACHE = [
  ...SHELL_ROUTES,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
  `${BASE}/icons/maskable-192.png`,
  `${BASE}/icons/maskable-512.png`,
  `${BASE}/icons/apple-touch-icon.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(PRECACHE);
      // Precache every script each shell route references, so offline
      // navigation hydrates fully (not just the prerendered document).
      const statics = await caches.open(STATIC_CACHE);
      const scripts = new Set();
      for (const route of SHELL_ROUTES) {
        const res = await shell.match(route);
        if (!res) continue;
        const html = await res.clone().text();
        for (const m of html.matchAll(
          /src="([^"]*\/_next\/static\/[^"]+\.js)"/g,
        )) {
          scripts.add(m[1]);
        }
      }
      await statics.addAll([...scripts]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigation: network-first so deploys land, cache fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match(`${BASE}/`);
        }),
    );
    return;
  }

  // Hashed build assets + fonts + icons: immutable, cache-first.
  if (
    url.pathname.startsWith(`${BASE}/_next/static/`) ||
    url.pathname.startsWith(`${BASE}/icons/`) ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Everything else same-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached ?? refresh;
    }),
  );
});
