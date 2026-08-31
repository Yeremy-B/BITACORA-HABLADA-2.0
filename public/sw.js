// Bitácora Hablada Service Worker v2.0.1
const CACHE_NAME = 'bitacora-hablada-v2.0.1';

// Instalación: cachear los archivos fundamentales del shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const base = self.registration.scope;
      // Precachear solo los archivos shell inmutables que existen tanto en dev como en build
      const assets = [
        base,
        new URL('index.html', base).href,
        new URL('manifest.json', base).href,
        new URL('icon-192.png', base).href,
        new URL('icon-512.png', base).href
      ];

      await Promise.allSettled(
        assets.map((assetUrl) => cache.add(assetUrl).catch((err) => {
          console.warn('[SW] No se pudo pre-cachear:', assetUrl, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Eliminando caché obsoleta:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Fetch:
// 1. Para HTML y navegación: Network-first con fallback a caché
// 2. Para recursos generados (JS/CSS en assets/ o src/, iconos, fuentes): Cache-First con actualización de fondo (Stale-While-Revalidate)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  const isNavigation = event.request.mode === 'navigate' || 
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const base = self.registration.scope;
          return caches.match(new URL('index.html', base).href) || caches.match(base);
        })
    );
    return;
  }

  // Stale-While-Revalidate para todos los demás recursos (assets Vite, CSS, JS, imágenes, fuentes)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Si no hay red y no está en caché, simplemente se silencia
        });

      return cachedResponse || fetchPromise;
    })
  );
});
