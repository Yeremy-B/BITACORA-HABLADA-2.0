// Bitácora Hablada Service Worker v2.3.0
const CACHE_NAME = 'bitacora-hablada-v2.3.0';

// Utilidad para limpiar assets viejos con hash o limitar a 30 entradas
async function manageAssetCache(cache, newUrl) {
  try {
    const isJs = newUrl.pathname.endsWith('.js');
    const isCss = newUrl.pathname.endsWith('.css');
    const keys = await cache.keys();

    // Eliminar versiones antiguas del mismo tipo (.js o .css)
    if (isJs || isCss) {
      for (const req of keys) {
        try {
          const u = new URL(req.url);
          if (u.pathname.includes('/assets/') && req.url !== newUrl.href) {
            if ((isJs && u.pathname.endsWith('.js')) || (isCss && u.pathname.endsWith('.css'))) {
              await cache.delete(req);
            }
          }
        } catch {
          // Ignorar URLs inválidas
        }
      }
    }

    // Limitar el caché de assets a un máximo de 30 entradas
    const updatedKeys = await cache.keys();
    const assetKeys = updatedKeys.filter((req) => req.url.includes('/assets/'));
    if (assetKeys.length > 30) {
      const toRemove = assetKeys.slice(0, assetKeys.length - 30);
      for (const req of toRemove) {
        await cache.delete(req);
      }
    }
  } catch (err) {
    console.warn('[SW] Error gestionando caché de assets:', err);
  }
}

// Instalación: cachear los archivos fundamentales del shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const base = self.registration.scope;
      // Precachear solo los archivos shell inmutables y el icono vectorial
      const assets = [
        base,
        new URL('index.html', base).href,
        new URL('manifest.json', base).href,
        new URL('icon.svg', base).href
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
  if (url.pathname.startsWith('/api/')) return;

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
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            if (url.pathname.includes('/assets/')) {
              await manageAssetCache(cache, url);
            }
            await cache.put(event.request, copy);
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
