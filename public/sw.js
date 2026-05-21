const CACHE_NAME = "tasadolar-v2";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/splash/apple-splash-1170x2532.png",
  "/splash/apple-splash-1179x2556.png",
  "/splash/apple-splash-1284x2778.png",
  "/splash/apple-splash-1290x2796.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled([cache.addAll(APP_SHELL), cachePageWithAssets("/")]),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(event));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      event.waitUntil(cachePageAssets(response.clone()));
    }
    return response;
  } catch {
    const fallback =
      (await cache.match(request, { ignoreSearch: true })) ??
      (await cache.match("/")) ??
      offlineFallback();
    event.waitUntil(notifyCachedPageUsed(event));
    return fallback;
  }
}

async function cachePageWithAssets(request) {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(request);
  if (!response.ok) return;

  await cache.put("/", response.clone());
  await cachePageAssets(response);
}

async function cachePageAssets(response) {
  const cache = await caches.open(CACHE_NAME);
  const html = await response.text();
  const urls = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g))
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.pathname + url.search)
    .filter((url) => !url.startsWith("/sw.js"));

  await Promise.allSettled([...new Set(urls)].map((url) => cache.add(url)));
}

function offlineFallback() {
  return new Response(
    '<!doctype html><html lang="es-VE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TasaDolar sin conexión</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif}.card{max-width:24rem;padding:1.5rem;text-align:center}.muted{color:#a1a1aa}</style></head><body><main class="card"><h1>TasaDolar</h1><p class="muted">Sin conexión. Abre la app una vez con internet para guardar las últimas tasas.</p></main></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function notifyCachedPageUsed(event) {
  const clientId = event.resultingClientId || event.clientId;
  const clientsToNotify = clientId
    ? [await self.clients.get(clientId)]
    : await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

  clientsToNotify.forEach((client) => {
    client?.postMessage({ type: "cached-page-used" });
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}
