const APP_VERSION = "1.3.0";
const SHELL_CACHE = `a7-seguridad-shell-v${APP_VERSION}`;
const PDF_CACHE = "a7-seguridad-pdf-v1";
const SHELL_FILES = ["./", "./index.html", `./styles.css?v=${APP_VERSION}`, `./app.js?v=${APP_VERSION}`, "./manifest.json", "./manuales.json", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png"];
const shellURL = path => new URL(path, self.registration.scope).href;

async function shellReady() {
    const cache = await caches.open(SHELL_CACHE);
    return (await Promise.all(SHELL_FILES.map(path => cache.match(shellURL(path))))).every(response => response?.ok);
}

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        // A worker revision with the same app version must not erase its active cache.
        if (await shellReady()) return;
        const stagingName = `${SHELL_CACHE}-preparing`;
        try {
            // Fetch everything before writing. Rejecting install keeps the active version.
            const responses = await Promise.all(SHELL_FILES.map(async path => {
                const response = await fetch(new Request(shellURL(path), {cache: "reload"}));
                if (!response.ok) throw new Error(`Essential resource failed: ${path} (HTTP ${response.status})`);
                const type = response.headers.get("content-type") || "";
                if (/\.js\?/.test(path) && !/(javascript|ecmascript)/i.test(type)) throw new Error(`Invalid JavaScript: ${path}`);
                if (/\.css\?/.test(path) && !/text\/css/i.test(type)) throw new Error(`Invalid CSS: ${path}`);
                if (path.endsWith(".json")) await response.clone().json();
                return response;
            }));
            const staging = await caches.open(stagingName);
            await Promise.all(SHELL_FILES.map((path, i) => staging.put(shellURL(path), responses[i])));
            const cache = await caches.open(SHELL_CACHE);
            await Promise.all(SHELL_FILES.map(async path => cache.put(shellURL(path), await staging.match(shellURL(path)))));
            await caches.delete(stagingName);
            if (!await shellReady()) throw new Error("Incomplete application cache");
        } catch (error) {
            await caches.delete(stagingName);
            // No complete active cache is touched: shellReady() returned above.
            await caches.delete(SHELL_CACHE);
            throw error;
        }
        // Let existing pages finish with their current version; do not mix releases.
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        if (!await shellReady()) throw new Error("Application cache is incomplete");
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith("a7-seguridad-shell-") && key !== SHELL_CACHE).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("message", event => {
    if (event.data?.type === "OFFLINE_STATUS") {
        event.waitUntil(shellReady().then(ready => event.ports[0]?.postMessage({ready, version: APP_VERSION})));
    }
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) return;
    event.respondWith((async () => {
        if (url.pathname.toLowerCase().endsWith(".pdf")) {
            const cache = await caches.open(PDF_CACHE);
            return await cache.match(request) || fetch(request);
        }
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        // Only navigation may fall back to HTML. Assets retain their real errors.
        if (request.mode === "navigate" && url.href.startsWith(self.registration.scope) && !/\.[^/]+$/.test(url.pathname)) {
            return await cache.match(shellURL("./index.html")) || fetch(request);
        }
        return fetch(request);
    })());
});
