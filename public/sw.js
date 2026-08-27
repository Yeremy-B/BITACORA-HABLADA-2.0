// Bitácora Hablada Service Worker v2.0.0
const CACHE_NAME = 'bitacora-hablada-v2.0.0';

// Archivos esenciales del shell de la aplicación (rutas relativas para GitHub Pages)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './src/style.css',
  './src/main.js'
];

// Instalación: cachear los archivos estáticos básicos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Intentar agregar los assets sin que uno falle e interrumpa los demás
      await Promise.allSettled(
        STATIC_ASSETS.map((asset) => cache.add(asset).catch((err) => {
          console.warn('[SW] No se pudo pre-cachear:', asset, err);
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
// 1. Para HTML y páginas: Network-first con fallback a caché (para tener siempre la versión fresca cuando haya internet)
// 2. Para CSS, JS, imágenes y fuentes: Stale-While-Revalidate o Cache-First, guardando en caché dinámica
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No interceptar peticiones a extensiones de chrome ni protocolos no soportados
  if (!url.protocol.startsWith('http')) return;

  const isNavigation = event.request.mode === 'navigate' || 
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    // Para navegación / HTML: Primero Red, con respaldo en Caché
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
          return caches.match('./index.html') || caches.match('/index.html') || caches.match('./');
        })
    );
    return;
  }

  // Para assets (CSS, JS, iconos, fuentes): Cache First con actualización en segundo plano (Stale-While-Revalidate)
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
          // Si no hay red y no está en caché, simplemente no retorna nada
        });

      return cachedResponse || fetchPromise;
    })
  );
});
