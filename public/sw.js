/* Flap PWA — cache static chrome only; never poison /app with marketing HTML. */
const CACHE = "flap-shell-v2";
const SHELL = ["/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API + SSE + HTML navigations always hit the network (Worker SPA shell / Assets).
  if (url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate" || req.destination === "document") return;
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
      return cached || network;
    }),
  );
});
