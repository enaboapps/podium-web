const CACHE = 'podium-v4';
const OFFLINE_URL = '/offline.html';
const CLERK_HOST = 'clerk.podiumspeak.xyz';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(request) {
  return caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    const networkPromise = fetch(request)
      .then((response) => {
        if (response) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => cached);

    return cached || networkPromise;
  });
}

function navigationFallback(cache, request) {
  return cache.match(request)
    .then((response) => response || cache.match('/library'))
    .then((response) => response || cache.match(OFFLINE_URL));
}

function networkFirstNavigation(request) {
  return caches.open(CACHE).then(async (cache) => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return navigationFallback(cache, request);
    }
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    url.origin === self.location.origin &&
    (
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/manifest.json' ||
      url.pathname === '/favicon.ico'
    )
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.hostname === CLERK_HOST) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
