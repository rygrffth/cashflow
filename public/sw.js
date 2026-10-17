const CACHE_NAME = 'cashflow-pwa-v4';
const STATIC_CACHE_NAME = 'cashflow-static-v4';

// Assets to cache immediately on SW installation
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install Event - Pre-cache with resilient error handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Pre-caching core assets');
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[Service Worker] Non-critical precache failed for:', asset, err);
          })
        )
      );
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

  // 6. Navigation/HTML Pages & Next.js RSC Prefetches -> Network First (fresh live financial data)
  const isRSC = request.headers.get('RSC') === '1';
  const isHTML = request.headers.get('accept')?.includes('text/html');

  if (isHTML || isRSC) {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }
});

// Network First Strategy (always fetch latest when online, cache fallback when offline)
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Fallback to cached root '/' if available
    const rootFallback = await cache.match('/');
    if (rootFallback) {
      return rootFallback;
    }
    return new Response(
      `<!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offline | Cashflow</title>
        <style>
          body { background: #0B0F19; color: #F8FAFC; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
          .card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(51, 65, 85, 0.6); padding: 32px; border-radius: 20px; max-width: 360px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h1 { font-size: 18px; margin: 12px 0 8px; color: #10B981; }
          p { font-size: 13px; color: #94A3B8; margin-bottom: 20px; }
          button { background: #10B981; color: #022C22; border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="font-size: 40px;">📶</div>
          <h1>Mode Offline</h1>
          <p>Koneksi internet Anda sedang terputus. Silakan hubungkan kembali internet Anda untuk melihat data terbaru.</p>
          <button onclick="window.location.reload()">Coba Lagi</button>
        </div>
      </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200,
      }
    );
  }
}

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
