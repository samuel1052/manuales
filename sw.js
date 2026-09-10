// Nombre de la memoria caché
const CACHE_NAME = 'a7-seguridad-v1';

// Lista de archivos que se guardarán para funcionar OFFLINE
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './app.js',
  './js/ficha.js',
  './manifest.json'
];

// Instalar Service Worker y guardar archivos en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Servir archivos desde la caché si no hay internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
