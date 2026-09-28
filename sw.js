const SHELL_CACHE = "a7-seguridad-shell-v1.2.0";
const PDF_CACHE = "a7-seguridad-pdf-v1";

const SHELL_FILES = [
    "./",
    "./index.html",
    "./styles.css?v=1.2.0",
    "./app.js?v=1.2.0",
    "./manifest.json",
    "./manuales.json",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png"
];


self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(SHELL_CACHE)
                .then(cache =>
                    cache.addAll(
                        SHELL_FILES
                    )
                )
                .catch(error =>
                    console.warn(
                        "Error precargando aplicación:",
                        error
                    )
                )
        );

        self.skipWaiting();
    }
);


self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches.keys()
                .then(keys => {

                    return Promise.all(

                        keys
                            .filter(
                                key =>
                                    key.startsWith(
                                        "a7-seguridad-shell-"
                                    ) &&
                                    key !== SHELL_CACHE
                            )
                            .map(
                                key =>
                                    caches.delete(
                                        key
                                    )
                            )
                    );
                })
                .then(() =>
                    self.clients.claim()
                )
        );
    }
);


self.addEventListener(
    "fetch",
    event => {

        const request =
            event.request;


        if (
            request.method !== "GET"
        ) {
            return;
        }


        const url =
            new URL(
                request.url
            );


        if (
            url.origin !==
            self.location.origin
        ) {
            return;
        }


        const isPdf =
            url.pathname
                .toLowerCase()
                .endsWith(".pdf");


        const isManualData =
            url.pathname
                .endsWith(
                    "/manuales.json"
                );


        /*
         * PDF
         *
         * Solo se utiliza la caché PDF.
         * No se guarda automáticamente.
         */
        if (isPdf) {

            event.respondWith(

                caches
                    .open(PDF_CACHE)
                    .then(
                        cache =>
                            cache.match(
                                request
                            )
                    )
                    .then(cached => {

                        if (cached) {
                            return cached;
                        }

                        return fetch(
                            request
                        );
                    })
            );

            return;
        }


        /*
         * manuales.json
         */
        if (isManualData) {

            event.respondWith(

                fetch(request)
                    .then(response => {

                        if (
                            response.ok
                        ) {

                            const copy =
                                response.clone();

                            caches
                                .open(
                                    SHELL_CACHE
                                )
                                .then(
                                    cache =>
                                        cache.put(
                                            request,
                                            copy
                                        )
                                );
                        }

                        return response;
                    })
                    .catch(
                        () =>
                            caches.match(
                                request
                            )
                    )
            );

            return;
        }


        /*
         * Aplicación
         *
         * Primero intenta caché.
         * Si no existe, utiliza red.
         */
        event.respondWith(

            caches
                .match(request)
                .then(cached => {

                    if (cached) {
                        return cached;
                    }

                    return fetch(request)
                        .catch(() =>
                            caches.match(
                                "./index.html"
                            )
                        );
                })
        );
    }
);
