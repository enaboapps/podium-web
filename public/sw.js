const CACHE = 'podium-v1';

// Cache Next.js static assets with cache-first (filenames are content-hashed)
// Cache navigation requests with network-first, falling back to cache when offline

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Next.js static chunks — cache-first (content-hashed, safe to cache forever)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Navigation — network-first, fall back to cache when offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
