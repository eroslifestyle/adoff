// AdOff Service Worker — minimal offline-capable shell
// Caches the homepage shell + critical assets; everything else is network-first.
const VERSION = "v2";
const CACHE = `adoff-shell-${VERSION}`;

const PRECACHE = [
  "/",
  "/style.css",
  "/assets/logo.svg",
  "/assets/og-image.png",
  "/assets/icon128.webp",
  "/assets/fonts/InterVariable.woff2",
  "/assets/fonts/InterVariable-Italic.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE).catch(() => null)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GET same-origin
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  // Never cache admin/management/API paths — always fresh from network.
  const p = new URL(req.url).pathname;
  if (p === "/admin" || p.startsWith("/admin/") || p.startsWith("/mgmt-") || p.startsWith("/api/") || p.startsWith("/account")) return;

  // i18n + api + JS/CSS with ?v= → network-first
  if (req.url.includes("/i18n/") || req.url.includes("?v=")) {
    event.respondWith(
      fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: cache-first
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
    )
  );
});
