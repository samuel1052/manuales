const APP_VERSION = "1.3.0";

const SHELL_CACHE = "a7-seguridad-shell-v1.3.0";
const PDF_CACHE = "a7-seguridad-pdf-v1";

class StorageService {

    static read(key, fallback = []) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    static write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {}
    }

    static getFavorites() {
        return this.read("biblioteca_favoritos", []);
    }

    static toggleFavorite(id) {
        let favorites = this.getFavorites();

        favorites = favorites.includes(id)
            ? favorites.filter(x => x !== id)
            : [...favorites, id];

        this.write("biblioteca_favoritos", favorites);

        return favorites.includes(id);
    }

    static isFavorite(id) {
        return this.getFavorites().includes(id);
    }

    static getHistory() {
        return this.read("biblioteca_historial", []);
    }

    static addToHistory(id) {
        let history = this.getHistory()
            .filter(x => x !== id);

        history.unshift(id);

        this.write(
            "biblioteca_historial",
            history.slice(0, 10)
        );
    }

    static getTheme() {
        try {
            return localStorage.getItem("biblioteca_tema") || "light";
        } catch {
            return "light";
        }
    }

    static setTheme(theme) {
        try {
            localStorage.setItem(
                "biblioteca_tema",
                theme
            );
        } catch {}
    }
}


class DataService {

    static manuals = [];

    static async loadData() {

        try {

            const response = await fetch(
                "./manuales.json",
                {
                    cache: "no-cache"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error(
                    "manuales.json no contiene un array"
                );
            }

            this.manuals = data;

            return true;

        } catch (error) {

            console.error(
                "Error cargando manuales:",
                error
            );

            return false;
        }
    }

    static getById(id) {
        return this.manuals.find(
            manual => manual.id === id
        );
    }

    static getBrands() {

        return [
            ...new Set(
                this.manuals
                    .map(m => m.marca)
                    .filter(Boolean)
            )
        ].sort(
            (a, b) => a.localeCompare(
                b,
                "es",
                { sensitivity: "base" }
            )
        );
    }

    static getCategories() {

        return [
            ...new Set(
                this.manuals
                    .map(m => m.categoria)
                    .filter(Boolean)
            )
        ].sort(
            (a, b) => a.localeCompare(
                b,
                "es",
                { sensitivity: "base" }
            )
        );
    }

    static search(
        query = "",
        category = "",
        brand = ""
    ) {

        const normalize = value =>
            String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();

        const q = normalize(query);

        return this.manuals.filter(manual => {

            if (
                category &&
                manual.categoria !== category
            ) {
                return false;
            }

            if (
                brand &&
                manual.marca !== brand
            ) {
                return false;
            }

            if (!q) {
                return true;
            }

            const searchableText = normalize(
                [
                    manual.marca,
                    manual.modelo,
                    manual.categoria,
                    manual.tipo,
                    manual.descripcion,
                    ...(Array.isArray(manual.tags)
                        ? manual.tags
                        : [])
                ].join(" ")
            );

            return searchableText.includes(q);
        });
    }
}


const AppUI = {

    totalZones: 1,
    totalCameras: 1,

    lastView: "view-home",

    init() {

        this.cacheDOM();

        this.bindEvents();

        this.populateFilters();

        this.loadTheme();

        this.initializeApp();

        this.updateOnlineState();

        window.addEventListener(
            "online",
            () => this.updateOnlineState()
        );

        window.addEventListener(
            "offline",
            () => this.updateOnlineState()
        );

        this.registerServiceWorker();
    },


    cacheDOM() {

        this.views =
            document.querySelectorAll(".view");

        this.navItems =
            document.querySelectorAll(".nav-item");

        this.mainSearch =
            document.getElementById(
                "main-search"
            );

        this.secSearch =
            document.getElementById(
                "secondary-search"
            );

        this.searchResults =
            document.getElementById(
                "search-results"
            );

        this.searchCount =
            document.getElementById(
                "search-count"
            );

        this.filterCat =
            document.getElementById(
                "filter-category"
            );

        this.filterBrand =
            document.getElementById(
                "filter-brand"
            );

        this.detailContent =
            document.getElementById(
                "detail-content"
            );
    },


    bindEvents() {
        document.getElementById("header-action")?.addEventListener("click", () => this.navigate("view-more"));

        this.navItems.forEach(item => {

            item.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    this.navigate(
                        item.dataset.target
                    );
                }
            );
        });


        this.mainSearch?.addEventListener(
            "focus",
            () => {

                this.navigate(
                    "view-search"
                );

                setTimeout(
                    () => this.secSearch?.focus(),
                    50
                );
            }
        );


        this.mainSearch?.addEventListener(
            "input",
            () => {

                this.navigate(
                    "view-search"
                );

                if (this.secSearch) {
                    this.secSearch.value =
                        this.mainSearch.value;
                }

                this.renderSearch();
            }
        );


        this.secSearch?.addEventListener(
            "input",
            () => this.renderSearch()
        );


        this.filterCat?.addEventListener(
            "change",
            () => this.renderSearch()
        );


        this.filterBrand?.addEventListener(
            "change",
            () => this.renderSearch()
        );


        document.querySelector(".categories-grid")?.addEventListener("click", event => {
            const button = event.target.closest(".cat-btn");
            if (!button) return;
            this.filterCat.value = button.dataset.cat;
            this.filterBrand.value = "";
            this.secSearch.value = "";
            this.navigate("view-search");
        });

        document
            .getElementById("theme-toggle")
            ?.addEventListener(
                "change",
                event => {

                    const theme =
                        event.target.checked
                            ? "dark"
                            : "light";

                    StorageService.setTheme(
                        theme
                    );

                    this.applyTheme(theme);
                }
            );


        document
            .getElementById("btn-back")
            ?.addEventListener(
                "click",
                () => {

                    this.navigate(
                        this.lastView
                    );
                }
            );


        document
            .getElementById("btn-clear-cache")
            ?.addEventListener(
                "click",
                () => this.clearPdfCache()
            );
    },


    async initializeApp() {

        const loaded =
            await DataService.loadData();

        this.populateFilters();

        this.renderHome();
        if (document.getElementById("view-search")?.classList.contains("active")) this.renderSearch();
        if (document.getElementById("view-favorites")?.classList.contains("active")) this.renderFavoritesFull();

        const status =
            document.getElementById(
                "app-status"
            );

        const count =
            DataService.manuals.length;

        const settingsCount =
            document.getElementById(
                "settings-manual-count"
            );

        if (settingsCount) {
            settingsCount.textContent =
                count;
        }

        if (status) {

            status.textContent = loaded
                ? `v${APP_VERSION} · ${count} equipos`
                : "Error cargando biblioteca";
        }
    },


    registerServiceWorker() {

        if (
            !("serviceWorker" in navigator)
        ) {
            return;
        }

        window.addEventListener(
            "load",
            async () => {

                try {

                    const registration = await navigator.serviceWorker.register("./sw.js", {updateViaCache: "none"});
                    const refresh = () => this.updateOnlineState();
                    navigator.serviceWorker.addEventListener("controllerchange", refresh);
                    registration.addEventListener("updatefound", () => {
                        registration.installing?.addEventListener("statechange", refresh);
                    });
                    navigator.serviceWorker.ready.then(refresh);
                    refresh();

                } catch (error) {

                    console.warn(
                        "Service Worker no disponible:",
                        error
                    );
                }
            }
        );
    },


    async updateOnlineState() {

        const online =
            navigator.onLine;

        const state =
            document.getElementById(
                "settings-online-state"
            );

        if (state) {

            state.textContent =
                online
                    ? "🟢 Conectado"
                    : "🔴 Sin conexión";
        }

        const status =
            document.getElementById(
                "offline-status"
            );

        if (status) {

            let ready = false;
            try {
                const worker = navigator.serviceWorker?.controller;
                if (worker) {
                    ready = await new Promise(resolve => {
                        const channel = new MessageChannel();
                        const timer = setTimeout(() => resolve(false), 2000);
                        channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data?.ready === true); };
                        worker.postMessage({type: "OFFLINE_STATUS"}, [channel.port2]);
                    });
                }
            } catch {}
            status.textContent = ready
                ? "Aplicación preparada para trabajar sin conexión. Solo están disponibles offline los PDF descargados."
                : "Aplicación aún no preparada para trabajar sin conexión. La conexión a Internet no garantiza la preparación offline.";

        }
    },


    navigate(viewId) {

        if (
            viewId !== "view-detail"
        ) {
            this.lastView =
                viewId;
        }

        this.views.forEach(view => {

            view.classList.remove(
                "active"
            );
        });

        document
            .getElementById(viewId)
            ?.classList.add("active");


        this.navItems.forEach(nav => {

            nav.classList.toggle(
                "active",
                nav.dataset.target === viewId
            );
        });


        if (viewId === "view-home") {
            this.renderHome();
        }

        if (viewId === "view-search") {
            this.renderSearch();
        }

        if (viewId === "view-favorites") {
            this.renderFavoritesFull();
        }

        if (viewId === "view-ficha") {
            this.renderFichaForm();
        }
    },


    getIconForCategory(category) {

        return {

            "Alarmas": "🚨",

            "CCTV": "📹",

            "Redes": "🌐",

            "Control de Acceso": "🚪",

            "Videoporteros": "📞",

            "Electricidad": "⚡",

            "Otros": "🔧"

        }[category] || "🔧";
    },


    escape(value) {

        return String(
            value ?? ""
        ).replace(
            /[&<>"']/g,
            character => ({

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"

            }[character])
        );
    },


    createItemCard(item) {

        const card =
            document.createElement(
                "div"
            );

        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Abrir ${item.marca} ${item.modelo}`);
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.openDetail(item.id);
            }
        });
        card.className =
            "item-card";

        card.innerHTML = `

            <div class="item-left">

                <div class="item-icon">
                    ${this.getIconForCategory(
                        item.categoria
                    )}
                </div>

                <div class="item-card-info">

                    <h3>
                        ${this.escape(
                            item.marca
                        )}
                        ${this.escape(
                            item.modelo
                        )}
                    </h3>

                    <p>
                        ${this.escape(
                            item.tipo
                        )}
                    </p>

                </div>

            </div>

            <div class="item-arrow">
                →
            </div>
        `;

        card.addEventListener(
            "click",
            () => this.openDetail(
                item.id
            )
        );

        return card;
    },


    renderHome() {

        const renderList =
            (
                elementId,
                ids,
                emptyMessage
            ) => {

                const box =
                    document.getElementById(
                        elementId
                    );

                if (!box) {
                    return;
                }

                box.innerHTML = "";

                if (!ids.length) {

                    box.innerHTML =
                        `<p class="empty-state">
                            ${emptyMessage}
                        </p>`;

                    return;
                }

                ids.forEach(id => {

                    const item =
                        DataService.getById(id);

                    if (item) {

                        box.appendChild(
                            this.createItemCard(
                                item
                            )
                        );
                    }
                });
            };


        renderList(
            "recent-list",
            StorageService.getHistory(),
            "No hay consultas recientes."
        );


        renderList(
            "favorites-list-home",
            StorageService
                .getFavorites()
                .slice(0, 3),
            "Aún no tienes favoritos."
        );
    },


    getAllCategories() {
        return [...new Set(["Alarmas", "CCTV", "Redes", "Control de Acceso", "Videoporteros", "Electricidad", "Otros", ...DataService.getCategories()])];
    },

    populateFilters() {
        const categorySelection = this.filterCat?.value || "";
        const brandSelection = this.filterBrand?.value || "";
        const grid = document.querySelector(".categories-grid");
        for (const category of this.getAllCategories()) {
            if ([...grid.children].some(button => button.dataset.cat === category)) continue;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cat-btn";
            button.dataset.cat = category;
            button.innerHTML = `<span>${this.getIconForCategory(category)}</span><strong>${this.escape(category)}</strong>`;
            grid.appendChild(button);
        }


        if (this.filterCat) {

            this.filterCat.innerHTML =
                `<option value="">
                    Todas las categorías
                </option>`;

            this.getAllCategories()
                .forEach(category => {

                    this.filterCat.add(
                        new Option(
                            category,
                            category
                        )
                    );
                });
        }


        if (this.filterCat) this.filterCat.value = categorySelection;
        if (this.filterBrand) {

            this.filterBrand.innerHTML =
                `<option value="">
                    Todas las marcas
                </option>`;

            DataService
                .getBrands()
                .forEach(brand => {

                    this.filterBrand.add(
                        new Option(
                            brand,
                            brand
                        )
                    );
                });
            this.filterBrand.value = brandSelection;
        }
    },


    renderSearch() {

        if (!this.searchResults) {
            return;
        }

        const results =
            DataService.search(

                this.secSearch?.value || "",

                this.filterCat?.value || "",

                this.filterBrand?.value || ""
            );


        this.searchResults.innerHTML =
            "";


        if (this.searchCount) {

            this.searchCount.textContent =
                `${results.length} ${
                    results.length === 1
                        ? "resultado"
                        : "resultados"
                }`;
        }


        if (!results.length) {

            this.searchResults.innerHTML =
                `<p class="empty-state">
                    ${this.filterCat?.value && !DataService.search("", this.filterCat.value).length ? "Esta categoría todavía no tiene equipos." : "No se encontraron equipos."}
                </p>`;

            return;
        }


        results.forEach(item => {

            this.searchResults.appendChild(
                this.createItemCard(item)
            );
        });
    },


    renderFavoritesFull() {

        const box =
            document.getElementById(
                "favorites-list-full"
            );

        if (!box) {
            return;
        }

        box.innerHTML = "";

        const favorites =
            StorageService.getFavorites();


        if (!favorites.length) {

            box.innerHTML =
                `<p class="empty-state">
                    Tu biblioteca de favoritos está vacía.
                </p>`;

            return;
        }


        favorites.forEach(id => {

            const item =
                DataService.getById(id);

            if (item) {

                box.appendChild(
                    this.createItemCard(item)
                );
            }
        });
    },


    field(id, label, options = null, type = "text") {
        const control = options
            ? `<select id="${id}"><option value="">Sin seleccionar</option>${options.map(v => `<option>${this.escape(v)}</option>`).join("")}</select>`
            : type === "textarea" ? `<textarea id="${id}" rows="3" autocomplete="off"></textarea>` : `<input id="${id}" type="${type}" autocomplete="off">`;
        return `<div class="form-group"><label for="${id}">${label}</label>${control}</div>`;
    },

    renderFichaForm() {
        const container = document.getElementById("ficha-form-container");
        // Keep the live DOM: installation data never enters persistent storage.
        if (!container || container.childElementCount) return;
        container.innerHTML = `<div class="ficha-card">
            <h3>📋 Datos de instalación</h3>
            ${this.field("f-cliente", "Cliente / Empresa")}
            ${this.field("f-ubicacion", "Ubicación")}
            ${this.field("f-fecha", "Fecha", null, "date")}
            <details open><summary>🌐 Red</summary>
            ${this.field("f-ip", "IP")}${this.field("f-gateway", "Gateway")}${this.field("f-puertos", "Puertos / servicios")}</details>
            <details><summary>📡 Acceso remoto</summary><p class="small-note">No introduzcas contraseñas.</p>
            ${[["p2p", "P2P"], ["dns", "DDNS"], ["vpn", "VPN"], ["otros", "Otro"]].map(([key, label]) => `<div class="remote-row"><label><input type="checkbox" class="remote-check" data-target="${key}-input"> ${label}</label><div class="form-group"><label for="${key}-input">Referencia ${label}</label><input id="${key}-input" autocomplete="off" disabled></div></div>`).join("")}</details>
            <details><summary>📹 Grabador</summary>${this.technicalFields("f-grab", [["marca", "Marca"], ["modelo", "Modelo"], ["serie", "Número de serie"], ["ip", "IP"], ["mac", "MAC"], ["puertos", "Puertos / servicios"], ["tecnologia", "Tecnología", ["IP", "HD", "Híbrida"]]])}</details>
            <h3>📹 Cámaras / canales</h3><div id="cctv-channels-list"></div>
            <button type="button" class="btn-add" id="btn-add-camera">➕ Añadir cámara</button>
            <details><summary>🚨 Central de alarma</summary>${this.technicalFields("f-alarm", [["marca", "Marca"], ["modelo", "Modelo"], ["serie", "Número de serie"]])}</details>
            <h3>🚨 Zonas</h3><p id="zone-count" aria-live="polite"></p><div id="alarm-zones-list"></div>
            <button type="button" class="btn-add" id="btn-add-zone">➕ Añadir zona</button>
            ${this.field("f-observaciones", "Observaciones técnicas", null, "textarea")}
            <div class="ficha-actions"><button class="btn-ficha primary" id="btn-copy-ficha">📋 Copiar para Notas</button><button class="btn-ficha secondary" id="btn-download-ficha">📥 Descargar TXT</button></div>
        </div>`;
        this.appendCamera();
        this.appendZone();
        container.querySelectorAll(".remote-check").forEach(check => check.addEventListener("change", () => {
            document.getElementById(check.dataset.target).disabled = !check.checked;
        }));
        document.getElementById("btn-add-camera").onclick = () => { this.totalCameras++; this.appendCamera(); };
        document.getElementById("btn-add-zone").onclick = () => { this.totalZones++; this.appendZone(); };
        container.addEventListener("input", () => this.updateZoneCount());
        container.addEventListener("change", () => this.updateZoneCount());
        document.getElementById("btn-copy-ficha").onclick = async () => {
            try { await navigator.clipboard.writeText(this.generarTextoFicha()); alert("Ficha copiada. Puedes pegarla en Notas."); }
            catch { alert("No se pudo copiar automáticamente. Usa Descargar TXT."); }
        };
        document.getElementById("btn-download-ficha").onclick = () => {
            const url = URL.createObjectURL(new Blob([this.generarTextoFicha()], {type: "text/plain;charset=utf-8"}));
            const link = document.createElement("a");
            link.href = url; link.download = "Ficha_Instalacion.txt"; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        this.updateZoneCount();
    },

    technicalFields(prefix, fields) {
        return fields.map(([key, label, options]) => this.field(`${prefix}-${key}`, label, options)).join("");
    },

    appendCamera() {
        const i = this.totalCameras;
        document.getElementById("cctv-channels-list").insertAdjacentHTML("beforeend", `<details open data-camera="${i}"><summary>Cámara ${i}</summary>${this.technicalFields(`f-ch-${i}`, [["nombre", "Ubicación o nombre"], ["marca", "Marca"], ["modelo", "Modelo"], ["serie", "Número de serie"], ["ip", "IP"], ["mac", "MAC"], ["puerto", "Puerto"], ["usuario", "Usuario (sin contraseña)"], ["tipo", "Tipo de cámara"], ["resolucion", "Resolución"], ["alimentacion", "PoE o alimentación"], ["observaciones", "Observaciones"]])}</details>`);
    },

    appendZone() {
        const i = this.totalZones;
        document.getElementById("alarm-zones-list").insertAdjacentHTML("beforeend", `<details open data-zone="${i}"><summary>Zona ${i}</summary>${this.technicalFields(`f-z-${i}`, [["numero", "Número de zona"], ["ubicacion", "Ubicación"], ["detector", "Detector asociado", ["Volumétrico", "Magnético", "Exterior", "Cortina", "Sombra", "Humo / Incendio", "Teclado / Sirena", "Otro"]], ["modelo", "Modelo del detector"], ["tipo", "Tipo de zona", ["Instantánea", "Retardada", "24 horas", "Pánico", "Incendio", "Sabotaje", "Exterior", "Llave / Armado", "Técnica", "Otro"]], ["particion", "Partición"], ["observaciones", "Observaciones"]])}</details>`);
    },

    filledFields(root) {
        return [...root.querySelectorAll("input, select, textarea")].filter(el => el.type !== "checkbox" && !el.disabled && el.value.trim()).map(el => `${document.querySelector(`label[for="${el.id}"]`).textContent}: ${el.value.trim()}`);
    },

    updateZoneCount() {
        const count = [...document.querySelectorAll("[data-zone]")].filter(zone => this.filledFields(zone).length).length;
        document.getElementById("zone-count").textContent = `${count} zonas cumplimentadas`;
    },

    value(id) { return document.getElementById(id)?.value?.trim() || ""; },

    generarTextoFicha() {
        const container = document.getElementById("ficha-form-container");
        const sections = [];
        const add = (title, lines) => { if (lines.length) sections.push(`--- ${title} ---\n${lines.join("\n")}`); };
        add("INSTALACIÓN", ["f-cliente", "f-ubicacion", "f-fecha", "f-observaciones"].filter(id => this.value(id)).map(id => `${document.querySelector(`label[for="${id}"]`).textContent}: ${this.value(id)}`));
        for (const detail of container.querySelectorAll("details")) {
            const lines = this.filledFields(detail);
            if (detail.querySelector(".remote-check")) {
                for (const check of detail.querySelectorAll(".remote-check:checked")) {
                    const label = check.parentElement.textContent.trim();
                    if (!this.value(check.dataset.target)) lines.push(label);
                }
            }
            add(detail.querySelector("summary").textContent, lines);
        }
        const count = [...container.querySelectorAll("[data-zone]")].filter(zone => this.filledFields(zone).length).length;
        if (count) sections.push(`Zonas cumplimentadas: ${count}`);
        return ["FICHA TÉCNICA DE INSTALACIÓN", ...sections].join("\n\n");
    },


    async openDetail(id) {

        const item =
            DataService.getById(id);

        if (!item) {
            return;
        }


        StorageService.addToHistory(
            id
        );


        const documents =
            Object.entries(
                item.documentos || {}
            )
            .filter(
                ([, url]) => Boolean(url)
            );


        const labels = {

            manual:
                "📕 Manual de usuario",

            instalacion:
                "🛠️ Manual de instalación",

            ficha:
                "⚙️ Ficha técnica",

            firmware:
                "💾 Firmware"
        };


        const buttons = [];


        for (
            const [type, url]
            of documents
        ) {

            const offline =
                await this.isCached(
                    url
                );


            buttons.push(`

                <div class="doc-row">

                    <a
                        href="${this.escape(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="doc-btn"
                    >
                        ${labels[type] || type}
                    </a>

                    <button
                        class="offline-btn ${
                            offline
                                ? "downloaded"
                                : ""
                        }"
                        data-offline-url="${this.escape(
                            url
                        )}"
                        type="button"
                    >
                        ${
                            offline
                                ? "✓ Offline"
                                : "↓ Offline"
                        }
                    </button>

                </div>
            `);
        }


        if (item.fabricante) {

            buttons.push(`

                <a
                    href="${this.escape(
                        item.fabricante
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="doc-btn secondary"
                >
                    🔗 Web del fabricante
                </a>
            `);
        }


        const favorite =
            StorageService.isFavorite(
                id
            );


        this.detailContent.innerHTML = `

            <div class="detail-header">

                <div class="detail-icon">
                    ${this.getIconForCategory(
                        item.categoria
                    )}
                </div>

                <div class="muted">
                    ${this.escape(
                        item.categoria
                    )}
                    ·
                    ${this.escape(
                        item.tipo
                    )}
                </div>

                <h2>
                    ${this.escape(
                        item.marca
                    )}
                    ${this.escape(
                        item.modelo
                    )}
                </h2>

                <p>
                    ${this.escape(
                        item.descripcion || ""
                    )}
                </p>

                <div class="detail-tags">

                    ${(item.tags || [])
                        .map(
                            tag =>
                                `<span>
                                    ${this.escape(tag)}
                                </span>`
                        )
                        .join("")}

                </div>

            </div>


            <div class="detail-docs">

                ${
                    buttons.length
                        ? buttons.join("")
                        : `
                            <p class="empty-state">
                                No hay documentos disponibles.
                            </p>
                        `
                }

            </div>


            <button
                class="fav-btn-large ${
                    favorite
                        ? "is-fav"
                        : ""
                }"
                id="btn-toggle-fav"
                type="button"
            >
                ${
                    favorite
                        ? "⭐ Quitar de favoritos"
                        : "☆ Añadir a favoritos"
                }
            </button>

        `;


        document
            .getElementById(
                "btn-toggle-fav"
            )
            ?.addEventListener(
                "click",
                event => {

                    const now =
                        StorageService.toggleFavorite(
                            id
                        );

                    event.currentTarget
                        .classList.toggle(
                            "is-fav",
                            now
                        );

                    event.currentTarget
                        .textContent =
                        now
                            ? "⭐ Quitar de favoritos"
                            : "☆ Añadir a favoritos";
                }
            );


        this.detailContent
            .querySelectorAll(
                ".offline-btn"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async event => {

                        const target =
                            event.currentTarget;

                        const url =
                            target.dataset
                                .offlineUrl;

                        target.disabled =
                            true;

                        try {

                            const result =
                                await this.toggleOffline(
                                    url
                                );

                            target.textContent =
                                result
                                    ? "✓ Offline"
                                    : "↓ Offline";

                            target.classList.toggle(
                                "downloaded",
                                result
                            );

                        } catch (error) {

                            console.error(
                                error
                            );

                            alert(
                                "No se pudo descargar el PDF. Comprueba la conexión."
                            );

                        } finally {

                            target.disabled =
                                false;
                        }
                    }
                );
            });


        this.navigate(
            "view-detail"
        );
    },


    async isCached(path) {
        if (!("caches" in window)) return false;
        try {
            const url = new URL(path, location.href).href;
            const cache = await caches.open(PDF_CACHE);
            return Boolean(await cache.match(url));
        } catch {
            // Cache access may be unavailable; online manuals must still open.
            return false;
        }
    },


    async toggleOffline(path) {

        if (!("caches" in window)) {

            throw new Error(
                "Cache API no disponible"
            );
        }


        const url =
            new URL(
                path,
                location.href
            ).href;


        const cache =
            await caches.open(
                PDF_CACHE
            );


        const existing =
            await cache.match(
                url
            );


        if (existing) {

            await cache.delete(
                url
            );

            return false;
        }


        const response =
            await fetch(
                url,
                {
                    cache: "no-cache"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        await cache.put(
            url,
            response.clone()
        );


        return true;
    },


    async clearPdfCache() {

        if (!("caches" in window)) {
            return;
        }


        const deleted =
            await caches.delete(
                PDF_CACHE
            );


        const status =
            document.getElementById(
                "offline-status"
            );


        if (status) {

            status.textContent =
                deleted
                    ? "🗑️ Se han eliminado los PDF descargados."
                    : "No había PDF descargados.";
        }
    },


    loadTheme() {

        const theme =
            StorageService.getTheme();

        const toggle =
            document.getElementById(
                "theme-toggle"
            );

        if (toggle) {

            toggle.checked =
                theme === "dark";
        }

        this.applyTheme(
            theme
        );
    },


    applyTheme(theme) {

        document.body.classList.toggle(
            "dark-mode",
            theme === "dark"
        );

        document.body.classList.toggle(
            "light-mode",
            theme !== "dark"
        );
    }
};


document.addEventListener(
    "DOMContentLoaded",
    () => AppUI.init()
);
