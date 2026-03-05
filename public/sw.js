const CACHE_NAME = 'tasadolar-v2';
const API_CACHE_NAME = 'tasadolar-api-v2';

const STATIC_ASSETS = [
  '/favicon.svg',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.webmanifest',
];

const API_CACHE_DURATION = 60 * 1000; // 1 minute for API cache
const STATIC_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for static assets

function getTimestamp() {
  return Date.now();
}

async function cacheWithExpiration(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  const responseClone = response.clone();
  const expirationTimestamp = getTimestamp() + (cacheName === API_CACHE_NAME ? API_CACHE_DURATION : STATIC_CACHE_DURATION);
  
  const headers = new Headers(responseClone.headers);
  headers.set('sw-cache-timestamp', String(expirationTimestamp));
  
  const expiredResponse = new Response(responseClone.body, {
    status: responseClone.status,
    statusText: responseClone.statusText,
    headers,
  });
  
  await cache.put(request, expiredResponse);
  return response;
}

function isCacheExpired(response) {
  if (!response) return true;
  const timestamp = response.headers.get('sw-cache-timestamp');
  if (!timestamp) return false;
  return Date.now() > parseInt(timestamp, 10);
}

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for pages/API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (but allow API calls to external services)
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/')) return;

  // API requests: stale-while-revalidate with short cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cacheWithExpiration(API_CACHE_NAME, request, response);
            }
            return response;
          })
          .catch(() => cached);

        // Return cached immediately if available and not expired, otherwise wait for network
        if (cached && !isCacheExpired(cached)) {
          return cached;
        }
        return fetchPromise;
      })
    );
    return;
  }

  // HTML pages: network-first with fallback to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            cacheWithExpiration(CACHE_NAME, request, response);
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Static assets (CSS, JS, images, fonts): cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && !isCacheExpired(cached)) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          cacheWithExpiration(CACHE_NAME, request, response);
        }
        return response;
      });
    })
  );
});
