const APP_VERSION = "1.2.0";

const SHELL_CACHE = "a7-seguridad-shell-v1.2.0";
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

    totalZones: 30,

    lastView: "view-home",

    init() {

        this.cacheDOM();

        this.bindEvents();

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


        document
            .querySelectorAll(".cat-btn")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        if (this.filterCat) {
                            this.filterCat.value =
                                button.dataset.cat;
                        }

                        if (this.secSearch) {
                            this.secSearch.value = "";
                        }

                        this.navigate(
                            "view-search"
                        );

                        this.renderSearch();
                    }
                );
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

                    await navigator.serviceWorker.register(
                        "./sw.js"
                    );

                } catch (error) {

                    console.warn(
                        "Service Worker no disponible:",
                        error
                    );
                }
            }
        );
    },


    updateOnlineState() {

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

            status.textContent =
                online
                    ? "Con conexión a Internet."
                    : "Sin conexión. Los PDF descargados siguen disponibles.";
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


    populateFilters() {

        if (this.filterCat) {

            this.filterCat.innerHTML =
                `<option value="">
                    Todas las categorías
                </option>`;

            DataService
                .getCategories()
                .forEach(category => {

                    this.filterCat.add(
                        new Option(
                            category,
                            category
                        )
                    );
                });
        }


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
                    No se encontraron equipos.
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


    renderFichaForm() {

        const container =
            document.getElementById(
                "ficha-form-container"
            );

        if (!container) {
            return;
        }


        container.innerHTML = `

            <div class="ficha-card">

                <h3>📋 Datos de instalación</h3>

                <div class="form-group">
                    <label>Cliente / Empresa</label>
                    <input
                        type="text"
                        id="f-cliente"
                        placeholder="Cliente / Empresa"
                    >
                </div>

                <div class="form-group">
                    <label>Ubicación</label>
                    <input
                        type="text"
                        id="f-ubicacion"
                        placeholder="Dirección / ubicación"
                    >
                </div>

                <div class="form-group">
                    <label>Fecha</label>
                    <input
                        type="date"
                        id="f-fecha"
                        value="${new Date()
                            .toISOString()
                            .split("T")[0]}"
                    >
                </div>


                <h3>🌐 Red</h3>

                <div class="form-group">
                    <label>IP</label>
                    <input
                        type="text"
                        id="f-ip"
                        placeholder="192.168.1.100"
                    >
                </div>

                <div class="form-group">
                    <label>Gateway</label>
                    <input
                        type="text"
                        id="f-gateway"
                        placeholder="192.168.1.1"
                    >
                </div>

                <div class="form-group">
                    <label>Puertos / servicios</label>
                    <input
                        type="text"
                        id="f-puertos"
                        placeholder="HTTP, HTTPS, RTSP, etc."
                    >
                </div>


                <h3>📹 CCTV</h3>

                <div class="form-group">

                    <label>Marca de cámaras</label>

                    <select id="f-cctv-cam-marca">

                        <option>Dahua</option>
                        <option>Hikvision</option>
                        <option>Vesta</option>
                        <option>Imou</option>
                        <option>Otros</option>

                    </select>

                    <input
                        type="text"
                        id="f-cctv-cam-otro"
                        class="conditional"
                        placeholder="Marca / modelo"
                    >

                </div>


                <div class="form-group">

                    <label>Marca de grabador</label>

                    <select id="f-cctv-grab-marca">

                        <option>Dahua</option>
                        <option>Hikvision</option>
                        <option>Vesta</option>
                        <option>Imou</option>
                        <option>Otros</option>

                    </select>

                    <input
                        type="text"
                        id="f-cctv-grab-otro"
                        class="conditional"
                        placeholder="Marca / modelo"
                    >

                </div>


                <div class="form-group">

                    <label>Tecnología</label>

                    <select id="f-cctv-tipo">

                        <option>IP</option>
                        <option>HD</option>
                        <option>Híbrida</option>

                    </select>

                </div>


                <div class="ficha-subsection">

                    <h4>📡 Acceso remoto</h4>

                    <p class="small-note">
                        No introduzcas contraseñas.
                    </p>

                    ${[
                        ["p2p", "P2P", "Número de serie / ID"],
                        ["dns", "DDNS", "Dominio"],
                        ["vpn", "VPN", "Servidor / referencia"],
                        ["otros", "Otro", "Descripción"]
                    ].map(
                        ([key, label, placeholder]) => `

                        <div class="remote-row">

                            <label class="checkbox-tag">

                                <input
                                    type="checkbox"
                                    class="remote-check"
                                    data-target="${key}-input"
                                >

                                <span>
                                    ${label}
                                </span>

                            </label>

                            <input
                                type="text"
                                id="${key}-input"
                                class="remote-input"
                                placeholder="${placeholder}"
                                disabled
                            >

                        </div>
                    `
                    ).join("")}

                </div>


                <h3>📹 Cámaras / canales</h3>

                <div
                    class="scrollable-box"
                    id="cctv-channels-list"
                ></div>


                <h3>🚨 Alarmas</h3>

                <div class="form-group">

                    <label>Central</label>

                    <select id="f-alarm-marca">

                        <option>Ajax</option>
                        <option>Hikvision</option>
                        <option>Vesta</option>
                        <option>DSC</option>
                        <option>Risco</option>
                        <option>Otro</option>

                    </select>

                    <input
                        type="text"
                        id="f-alarm-otro"
                        class="conditional"
                        placeholder="Marca / modelo"
                    >

                </div>


                <h3>🚨 Mapeo de zonas</h3>

                <div
                    class="scrollable-box"
                    id="alarm-zones-list"
                ></div>

                <button
                    type="button"
                    class="btn-add"
                    id="btn-add-zone"
                >
                    ➕ Añadir 5 zonas
                </button>


                <h3>📝 Observaciones técnicas</h3>

                <textarea
                    id="f-observaciones"
                    rows="5"
                    placeholder="Incidencias, pruebas, pendientes..."
                ></textarea>


                <div class="ficha-actions">

                    <button
                        class="btn-ficha primary"
                        id="btn-copy-ficha"
                    >
                        📋 Copiar para Notas
                    </button>

                    <button
                        class="btn-ficha secondary"
                        id="btn-download-ficha"
                    >
                        📥 Descargar TXT
                    </button>

                </div>

            </div>
        `;


        const channels =
            document.getElementById(
                "cctv-channels-list"
            );


        for (
            let i = 1;
            i <= 32;
            i++
        ) {

            channels.insertAdjacentHTML(
                "beforeend",
                `
                <div class="grid-row">

                    <span class="row-num">
                        CH${i}
                    </span>

                    <input
                        type="text"
                        id="f-ch-name-${i}"
                        placeholder="Cámara ${i}"
                    >

                    <input
                        type="text"
                        id="f-ch-ip-${i}"
                        placeholder="IP"
                    >

                    <input
                        type="text"
                        id="f-ch-port-${i}"
                        placeholder="Puerto"
                    >

                </div>
                `
            );
        }


        this.renderZones();


        container
            .querySelectorAll(
                ".remote-check"
            )
            .forEach(check => {

                check.addEventListener(
                    "change",
                    event => {

                        const input =
                            document.getElementById(
                                event.target.dataset.target
                            );

                        if (!input) {
                            return;
                        }

                        input.disabled =
                            !event.target.checked;

                        if (
                            !event.target.checked
                        ) {
                            input.value = "";
                        }
                    }
                );
            });


        [
            [
                "f-cctv-cam-marca",
                "f-cctv-cam-otro"
            ],
            [
                "f-cctv-grab-marca",
                "f-cctv-grab-otro"
            ],
            [
                "f-alarm-marca",
                "f-alarm-otro"
            ]
        ].forEach(
            ([selectId, inputId]) => {

                const select =
                    document.getElementById(
                        selectId
                    );

                const input =
                    document.getElementById(
                        inputId
                    );

                const update =
                    () => {

                        input.classList.toggle(
                            "visible",
                            select.value === "Otros" ||
                            select.value === "Otro"
                        );
                    };

                select.addEventListener(
                    "change",
                    update
                );

                update();
            }
        );


        document
            .getElementById("btn-add-zone")
            ?.addEventListener(
                "click",
                () => {

                    this.totalZones += 5;

                    this.renderZones();
                }
            );


        document
            .getElementById("btn-copy-ficha")
            ?.addEventListener(
                "click",
                async () => {

                    try {

                        await navigator.clipboard.writeText(
                            this.generarTextoFicha()
                        );

                        alert(
                            "✅ Ficha copiada. Puedes pegarla en Notas."
                        );

                    } catch {

                        alert(
                            "No se pudo copiar automáticamente. Usa Descargar TXT."
                        );
                    }
                }
            );


        document
            .getElementById("btn-download-ficha")
            ?.addEventListener(
                "click",
                () => {

                    const text =
                        this.generarTextoFicha();

                    const blob =
                        new Blob(
                            [text],
                            {
                                type:
                                    "text/plain;charset=utf-8"
                            }
                        );

                    const url =
                        URL.createObjectURL(
                            blob
                        );

                    const link =
                        document.createElement(
                            "a"
                        );

                    link.href = url;

                    link.download =
                        `Ficha_${
                            (
                                this.value(
                                    "f-cliente"
                                ) ||
                                "Instalacion"
                            )
                        }.txt`;

                    link.click();

                    URL.revokeObjectURL(
                        url
                    );
                }
            );
    },


    renderZones() {

        const box =
            document.getElementById(
                "alarm-zones-list"
            );

        if (!box) {
            return;
        }


        const old = {};


        for (
            let i = 1;
            i <= this.totalZones;
            i++
        ) {

            old[i] = {

                name:
                    document.getElementById(
                        `f-z-name-${i}`
                    )?.value || "",

                detector:
                    document.getElementById(
                        `f-z-detector-${i}`
                    )?.value ||
                    "Volumétrico",

                zoneType:
                    document.getElementById(
                        `f-z-type-${i}`
                    )?.value ||
                    "Instantánea"
            };
        }


        box.innerHTML = "";


        const detectorTypes = [
            "Volumétrico",
            "Magnético",
            "Exterior",
            "Cortina",
            "Sombra",
            "Humo / Incendio",
            "Teclado / Sirena",
            "Otro"
        ];


        const zoneTypes = [
            "Instantánea",
            "Retardada",
            "Pánico",
            "24 horas",
            "Incendio",
            "Sabotaje",
            "Exterior",
            "Llave / Armado",
            "Técnica",
            "Otro"
        ];


        for (
            let i = 1;
            i <= this.totalZones;
            i++
        ) {

            box.insertAdjacentHTML(
                "beforeend",
                `
                <div class="zone-block">

                    <div class="zone-title">
                        Z${i}
                    </div>

                    <input
                        type="text"
                        id="f-z-name-${i}"
                        placeholder="Ubicación / detector"
                    >

                    <select
                        id="f-z-detector-${i}"
                    >
                        ${detectorTypes
                            .map(
                                value =>
                                    `<option>${value}</option>`
                            )
                            .join("")}
                    </select>

                    <select
                        id="f-z-type-${i}"
                    >
                        ${zoneTypes
                            .map(
                                value =>
                                    `<option>${value}</option>`
                            )
                            .join("")}
                    </select>

                </div>
                `
            );


            if (old[i]) {

                document.getElementById(
                    `f-z-name-${i}`
                ).value =
                    old[i].name;

                document.getElementById(
                    `f-z-detector-${i}`
                ).value =
                    old[i].detector;

                document.getElementById(
                    `f-z-type-${i}`
                ).value =
                    old[i].zoneType;
            }
        }
    },


    value(id) {

        return (
            document.getElementById(id)
                ?.value
                ?.trim() ||
            "N/A"
        );
    },


    generarTextoFicha() {

        const value =
            id => this.value(id);


        const selected =
            (
                id,
                otherId
            ) => {

                const selectedValue =
                    value(id);

                if (
                    selectedValue === "Otros" ||
                    selectedValue === "Otro"
                ) {

                    const other =
                        value(otherId);

                    return other === "N/A"
                        ? selectedValue
                        : other;
                }

                return selectedValue;
            };


        const remote =
            [
                "p2p",
                "dns",
                "vpn",
                "otros"
            ]
                .map(key => {

                    const check =
                        document.querySelector(
                            `[data-target="${key}-input"]`
                        );

                    return check?.checked
                        ? `${key.toUpperCase()}: ${value(
                            `${key}-input`
                        )}`
                        : null;
                })
                .filter(Boolean)
                .join(" | ") ||
            "Sin configuración remota";


        const channels = [];


        for (
            let i = 1;
            i <= 32;
            i++
        ) {

            const name =
                value(
                    `f-ch-name-${i}`
                );

            if (
                name !== "N/A"
            ) {

                channels.push(
                    `CH${i}: ${name} | IP: ${
                        value(
                            `f-ch-ip-${i}`
                        )
                    } | Puerto: ${
                        value(
                            `f-ch-port-${i}`
                        )
                    }`
                );
            }
        }


        const zones = [];


        for (
            let i = 1;
            i <= this.totalZones;
            i++
        ) {

            const name =
                value(
                    `f-z-name-${i}`
                );

            if (
                name !== "N/A"
            ) {

                zones.push(
                    `Z${i}: ${name} | Detector: ${
                        value(
                            `f-z-detector-${i}`
                        )
                    } | Tipo: ${
                        value(
                            `f-z-type-${i}`
                        )
                    }`
                );
            }
        }


        return `========================================
FICHA TÉCNICA DE INSTALACIÓN
========================================

FECHA: ${value("f-fecha")}
CLIENTE: ${value("f-cliente")}
UBICACIÓN: ${value("f-ubicacion")}

--- RED ---

IP: ${value("f-ip")}
GATEWAY: ${value("f-gateway")}
PUERTOS / SERVICIOS: ${value("f-puertos")}

--- CCTV ---

CÁMARAS: ${selected(
    "f-cctv-cam-marca",
    "f-cctv-cam-otro"
)}

GRABADOR: ${selected(
    "f-cctv-grab-marca",
    "f-cctv-grab-otro"
)}

TECNOLOGÍA: ${value(
    "f-cctv-tipo"
)}

ACCESO REMOTO:
${remote}

--- CANALES CCTV ---

${
    channels.join("\n") ||
    "Sin cámaras registradas."
}

--- ALARMA ---

CENTRAL: ${selected(
    "f-alarm-marca",
    "f-alarm-otro"
)}

--- ZONAS ---

${
    zones.join("\n") ||
    "Sin zonas registradas."
}

--- OBSERVACIONES TÉCNICAS ---

${value(
    "f-observaciones"
)}

NOTA:
No se almacenan contraseñas ni credenciales
en esta ficha.

========================================`;
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

        if (!("caches" in window)) {
            return false;
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


        return Boolean(
            await cache.match(url)
        );
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
