const CACHE_NAME = "accessq-static-v2";
const ASSETS_TO_CACHE = ["/manifest.json", "/icon.png", "/icon2.png"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isPrecachedAsset =
    url.origin === self.location.origin &&
    url.search === "" &&
    ASSETS_TO_CACHE.includes(url.pathname);

  // Les pages Next.js, leurs données RSC et les appels API doivent toujours
  // venir du déploiement courant. Un ancien HTML peut référencer des fichiers
  // CSS/JS supprimés lors du déploiement suivant.
  if (!isPrecachedAsset) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(caches.match(request).then((response) => response || fetch(request)));
});
