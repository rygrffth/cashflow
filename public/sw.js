const CACHE_NAME = 'cashflow-pwa-v1';
const STATIC_CACHE_NAME = 'cashflow-static-v1';

// Assets to cache immediately on SW installation
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching core assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  const cacheAllowlist = [CACHE_NAME, STATIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheAllowlist.includes(cacheName)) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle GET requests and local origins
  if (request.method !== 'GET') return;

  // Handle cross-origin assets like Google Fonts
  const isGoogleFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  
  if (!url.origin.startsWith(self.location.origin) && !isGoogleFont) {
    return;
  }

  // 2. Do NOT cache API calls or Supabase requests
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/rest/v1/')) {
    return;
  }

  // 3. For Google Fonts, use Cache First
  if (isGoogleFont) {
    event.respondWith(cacheFirst(request, 'google-fonts-cache'));
    return;
  }

  // 4. Next.js Static Assets (_next/static/...) -> Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // 5. Images / Icons -> Cache First
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/) ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // 6. Navigation/HTML Pages & Next.js RSC Prefetches -> Stale-While-Revalidate
  const isRSC = request.headers.get('RSC') === '1';
  const isHTML = request.headers.get('accept')?.includes('text/html');

  if (isHTML || isRSC) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }
});

// Cache First Strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    // Only cache successful standard responses
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Fail silently, returning standard error response
    return new Response('Offline: Resource not found in cache', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Stale-While-Revalidate Strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Return cached response if offline/network fails
    return cachedResponse;
  });

  return cachedResponse || fetchPromise;
}
