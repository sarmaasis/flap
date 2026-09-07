/* Flap PWA — cache static chrome only; never poison /app with marketing HTML. */
const CACHE = "flap-shell-v3";
const SHELL = ["/manifest.webmanifest", "/favicon.svg"];

// Vite dev serves the app as raw ES modules from these prefixes, and stamps every
// pre-bundled dependency with a ?v= hash that changes on each re-optimize. A cached
// module graph therefore points at dep URLs the server no longer recognises and
// answers with 504 (Outdated Optimize Dep).
const DEV_PREFIXES = ["/@", "/src/", "/shared/", "/node_modules/"];

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
  if (DEV_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

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
