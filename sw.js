// JPSoft | Cocheras — Service Worker
const CACHE_NAME = "jpsoft-cocheras-v7";

const STATIC_ASSETS = [
  "./index.html",
  "./app.js",
  "./styles.css",
  "./favicon.ico",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: "reload" })))
        .catch((err) => console.warn("[SW] No se pudo cachear algún recurso:", err))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const networkOnly = ["firebaseio.com", "googleapis.com/identitytoolkit", "securetoken.googleapis.com", "tusfacturas.app", "wa.me"];
  if (networkOnly.some((d) => url.hostname.includes(d) || (url.hostname + url.pathname).includes(d))) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && (url.origin === self.location.origin || url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com"))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") return caches.match("./index.html");
        });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
