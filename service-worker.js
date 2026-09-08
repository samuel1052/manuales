const CACHE_NAME = 'biblioteca-tecnica-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manuales.json',
    './manifest.json'
];

// Instalación: Cachea los recursos básicos de la interfaz
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activación: Limpia cachés antiguos
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
        })
    );
});

// Intercepción de peticiones
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // ESTRATEGIA PARA PDFs: Caché bajo demanda (Cache First, luego Network)
    if (url.pathname.endsWith('.pdf')) {
        event.respondWith(
            caches.match(event.request).then(response => {
                // Si está en caché (ya se abrió una vez), devuélvelo offline
                if (response) return response;
                
                // Si no, descárgalo de la red y guárdalo en la caché para el futuro
                return fetch(event.request).then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // ESTRATEGIA PARA EL RESTO (Stale-While-Revalidate o Network First)
    // Para manuales.json vamos a la red primero para tener siempre la base de datos actualizada
    if (url.pathname.endsWith('manuales.json')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Para la UI (HTML, CSS, JS): Cache First
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
