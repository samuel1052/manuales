const CACHE_NAME = 'biblioteca-tecnica-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manuales.json',
    './manifest.json'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // PDFs: Solo guarda en caché si la descarga es un éxito (status 200)
    if (url.pathname.endsWith('.pdf')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse && cachedResponse.ok) {
                    return cachedResponse;
                }
                
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return cachedResponse || new Response('Archivo no disponible offline', { status: 404 });
                });
            })
        );
        return;
    }

    if (url.pathname.endsWith('manuales.json')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
