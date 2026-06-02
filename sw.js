// JPSoft | Cocheras — Service Worker
// Estrategia: cache-first para archivos estáticos, network-first para Firebase

const CACHE_NAME = "jpsoft-cocheras-v1";

const STATIC_ASSETS = [
  "./index.html",
  "./app.js",
  "./styles.css",
  "./favicon.ico",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap",
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
];

// ── Instalación: cachear archivos estáticos ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: "reload" })))
        .catch((err) => {
          console.warn("[SW] No se pudo cachear algún recurso:", err);
        });
    })
  );
  self.skipWaiting();
});

// ── Activación: limpiar caches viejas ───────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estrategia según tipo de request ──────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Firebase, TusFacturasAPP y APIs externas → siempre network (nunca cachear)
  const networkOnly = [
    "firebaseio.com",
    "googleapis.com/identitytoolkit",
    "securetoken.googleapis.com",
    "tusfacturas.app",
    "wa.me"
  ];
  if (networkOnly.some((domain) => url.hostname.includes(domain))) {
    return; // dejar pasar sin interceptar
  }

  // Archivos estáticos → cache-first, fallback a network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Solo cachear respuestas válidas de nuestro origen o CDNs conocidos
          if (
            response.ok &&
            (url.origin === self.location.origin ||
              url.hostname.includes("fonts.googleapis.com") ||
              url.hostname.includes("jsdelivr.net"))
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Sin conexión y sin cache → devolver index.html como fallback
          if (event.request.destination === "document") {
            return caches.match("./index.html");
          }
        });
    })
  );
});

// ── Mensaje para forzar actualización desde la app ───────────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
