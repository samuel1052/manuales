const APP_VERSION = "1.1.0";
const MANUAL_CACHE = "a7-seguridad-v1.1.0";

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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  static getFavorites() { return this.read("biblioteca_favoritos", []); }
  static toggleFavorite(id) {
    let favs = this.getFavorites();
    favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    this.write("biblioteca_favoritos", favs);
    return favs.includes(id);
  }
  static isFavorite(id) { return this.getFavorites().includes(id); }
  static getHistory() { return this.read("biblioteca_historial", []); }
  static addToHistory(id) {
    let h = this.getHistory().filter(x => x !== id);
    h.unshift(id);
    this.write("biblioteca_historial", h.slice(0, 10));
  }
  static getTheme() { return localStorage.getItem("biblioteca_tema") || "light"; }
  static setTheme(theme) { try { localStorage.setItem("biblioteca_tema", theme); } catch {} }
}

class DataService {
  static manuals = [];
  static async loadData() {
    try {
      const response = await fetch("manuales.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("manuales.json no contiene un array");
      this.manuals = data;
      return true;
    } catch (error) {
      console.error("Error cargando manuales:", error);
      return false;
    }
  }
  static getById(id) { return this.manuals.find(m => m.id === id); }
  static getBrands() { return [...new Set(this.manuals.map(m => m.marca).filter(Boolean))].sort(); }
  static getCategories() { return [...new Set(this.manuals.map(m => m.categoria).filter(Boolean))].sort(); }
  static search(query, category = "", brand = "") {
    const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = normalize(query);
    return this.manuals.filter(m => {
      if (category && m.categoria !== category) return false;
      if (brand && m.marca !== brand) return false;
      if (!q) return true;
      const text = normalize([
        m.marca, m.modelo, m.categoria, m.tipo, m.descripcion,
        ...(Array.isArray(m.tags) ? m.tags : [])
      ].join(" "));
      return text.includes(q);
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
    this.registerServiceWorker();
  },

  cacheDOM() {
    this.views = document.querySelectorAll(".view");
    this.navItems = document.querySelectorAll(".nav-item");
    this.mainSearch = document.getElementById("main-search");
    this.secSearch = document.getElementById("secondary-search");
    this.searchResults = document.getElementById("search-results");
    this.filterCat = document.getElementById("filter-category");
    this.filterBrand = document.getElementById("filter-brand");
    this.detailContent = document.getElementById("detail-content");
  },

  bindEvents() {
    this.navItems.forEach(item => item.addEventListener("click", e => {
      e.preventDefault();
      this.navigate(item.dataset.target);
    }));

    this.mainSearch?.addEventListener("focus", () => {
      this.navigate("view-search");
      this.secSearch?.focus();
    });
    this.mainSearch?.addEventListener("input", () => {
      this.navigate("view-search");
      if (this.secSearch) this.secSearch.value = this.mainSearch.value;
      this.renderSearch();
    });
    this.secSearch?.addEventListener("input", () => this.renderSearch());
    this.filterCat?.addEventListener("change", () => this.renderSearch());
    this.filterBrand?.addEventListener("change", () => this.renderSearch());

    document.querySelectorAll(".cat-btn").forEach(btn => btn.addEventListener("click", () => {
      this.filterCat.value = btn.dataset.cat;
      this.secSearch.value = "";
      this.navigate("view-search");
      this.renderSearch();
    }));

    document.getElementById("theme-toggle")?.addEventListener("change", e => {
      const theme = e.target.checked ? "dark" : "light";
      StorageService.setTheme(theme);
      this.applyTheme(theme);
    });

    document.getElementById("btn-back")?.addEventListener("click", () => this.navigate(this.lastView));
    document.getElementById("btn-clear-cache")?.addEventListener("click", () => this.clearAppCache());
  },

  async initializeApp() {
    const loaded = await DataService.loadData();
    this.populateFilters();
    this.renderHome();
    const status = document.getElementById("app-status");
    if (status) status.textContent = loaded
      ? `VersiÃ³n ${APP_VERSION} Â· Biblioteca cargada Â· ${DataService.manuals.length} equipos`
      : "No se pudo cargar la biblioteca. Comprueba la conexiÃ³n y recarga.";
  },

  registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("./sw.js");
      } catch (error) {
        console.warn("Service Worker no disponible:", error);
      }
    });
  },

  navigate(viewId) {
    if (viewId !== "view-detail") this.lastView = viewId;
    this.views.forEach(v => v.classList.remove("active"));
    document.getElementById(viewId)?.classList.add("active");
    this.navItems.forEach(nav => nav.classList.toggle("active", nav.dataset.target === viewId));
    if (viewId === "view-home") this.renderHome();
    if (viewId === "view-search") this.renderSearch();
    if (viewId === "view-favorites") this.renderFavoritesFull();
    if (viewId === "view-ficha") this.renderFichaForm();
  },

  getIconForCategory(cat) {
    return {
      "Alarmas": "ðŸš¨", "CCTV": "ðŸ“¹", "Redes": "ðŸŒ",
      "Control de Acceso": "ðŸšª", "Videoporteros": "ðŸ“ž",
      "Electricidad": "âš¡"
    }[cat] || "ðŸ”§";
  },

  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
  },

  createItemCard(item) {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-left">
        <div class="item-icon">${this.getIconForCategory(item.categoria)}</div>
        <div class="item-card-info">
          <h3>${this.escape(item.marca)} ${this.escape(item.modelo)}</h3>
          <p>${this.escape(item.tipo)}</p>
        </div>
      </div>
      <div class="item-arrow">âžœ</div>`;
    card.addEventListener("click", () => this.openDetail(item.id));
    return card;
  },

  renderHome() {
    const renderList = (id, ids, empty) => {
      const box = document.getElementById(id);
      if (!box) return;
      box.innerHTML = "";
      if (!ids.length) {
        box.innerHTML = `<p class="empty-state">${empty}</p>`;
        return;
      }
      ids.forEach(id => {
        const item = DataService.getById(id);
        if (item) box.appendChild(this.createItemCard(item));
      });
    };
    renderList("recent-list", StorageService.getHistory(), "No hay consultas recientes.");
    renderList("favorites-list-home", StorageService.getFavorites().slice(0, 3), "AÃºn no tienes favoritos.");
  },

  populateFilters() {
    if (this.filterCat) DataService.getCategories().forEach(x => this.filterCat.add(new Option(x, x)));
    if (this.filterBrand) DataService.getBrands().forEach(x => this.filterBrand.add(new Option(x, x)));
  },

  renderSearch() {
    if (!this.searchResults) return;
    const results = DataService.search(
      this.secSearch?.value || "",
      this.filterCat?.value || "",
      this.filterBrand?.value || ""
    );
    this.searchResults.innerHTML = "";
    if (!results.length) {
      this.searchResults.innerHTML = `<p class="empty-state">No se encontraron resultados.</p>`;
      return;
    }
    results.forEach(item => this.searchResults.appendChild(this.createItemCard(item)));
  },

  renderFavoritesFull() {
    const box = document.getElementById("favorites-list-full");
    if (!box) return;
    box.innerHTML = "";
    const favs = StorageService.getFavorites();
    if (!favs.length) {
      box.innerHTML = `<p class="empty-state">Tu biblioteca de favoritos estÃ¡ vacÃ­a.</p>`;
      return;
    }
    favs.forEach(id => {
      const item = DataService.getById(id);
      if (item) box.appendChild(this.createItemCard(item));
    });
  },

  renderFichaForm() {
    const container = document.getElementById("ficha-form-container");
    if (!container) return;
    this.totalZones = Math.max(this.totalZones || 30, 30);

    container.innerHTML = `
      <div class="ficha-card">
        <h3>ðŸ“‹ Datos de instalaciÃ³n</h3>
        <input type="text" id="f-cliente" placeholder="Cliente / Empresa">
        <input type="text" id="f-ubicacion" placeholder="DirecciÃ³n / UbicaciÃ³n">
        <input type="date" id="f-fecha" value="${new Date().toISOString().split("T")[0]}">

        <h3>ðŸŒ Red</h3>
        <input type="text" id="f-ip" placeholder="IP asignada">
        <input type="text" id="f-gateway" placeholder="Gateway">
        <input type="text" id="f-puertos" placeholder="Puertos / servicios utilizados">

        <h3>ðŸ“¹ CCTV</h3>
        <div class="form-group"><label>Marca de cÃ¡maras</label>
          <select id="f-cctv-cam-marca" class="styled-select">
            <option>Dahua</option><option>Hikvision</option><option>Vesta</option><option>Imou</option><option>Otros</option>
          </select>
          <input type="text" id="f-cctv-cam-otro" placeholder="Marca / modelo" class="conditional">
        </div>
        <div class="form-group"><label>Marca de grabador</label>
          <select id="f-cctv-grab-marca" class="styled-select">
            <option>Dahua</option><option>Hikvision</option><option>Vesta</option><option>Imou</option><option>Otros</option>
          </select>
          <input type="text" id="f-cctv-grab-otro" placeholder="Marca / modelo" class="conditional">
        </div>
        <div class="form-group"><label>TecnologÃ­a</label>
          <select id="f-cctv-tipo" class="styled-select"><option>IP</option><option>HD</option></select>
        </div>

        <div class="ficha-subsection">
          <h4>ðŸ“¡ Acceso remoto</h4>
          <p class="small-note">No introduzcas contraseÃ±as. Guarda las credenciales en tu gestor o notas seguras.</p>
          ${[
            ["p2p","P2P","NÂº serie / ID"],
            ["dns","DDNS","Dominio"],
            ["vpn","VPN","Servidor / referencia"],
            ["otros","Otro","DescripciÃ³n"]
          ].map(([key,label,ph]) => `
            <div class="remote-row">
              <label class="checkbox-tag"><input type="checkbox" class="remote-check" data-target="${key}-input"><span>${label}</span></label>
              <input type="text" id="${key}-input" class="remote-input" placeholder="${ph}" disabled>
            </div>`).join("")}
        </div>

        <h4>ðŸ“¹ Canales / cÃ¡maras</h4>
        <div class="scrollable-box" id="cctv-channels-list"></div>

        <h3>ðŸš¨ Alarmas</h3>
        <div class="form-group"><label>Central</label>
          <select id="f-alarm-marca" class="styled-select">
            <option>Ajax</option><option>Hikvision</option><option>Vesta</option><option>DSC</option><option>Risco</option><option>Otro</option>
          </select>
          <input type="text" id="f-alarm-otro" placeholder="Marca / modelo" class="conditional">
        </div>

        <h4>ðŸš¨ Mapeo de zonas</h4>
        <div class="scrollable-box" id="alarm-zones-list"></div>
        <button type="button" class="btn-add" id="btn-add-zone">âž• AÃ±adir 5 zonas</button>

        <h3>ðŸ“ Observaciones tÃ©cnicas</h3>
        <textarea id="f-observaciones" placeholder="Incidencias, pruebas, pendientes, ubicaciÃ³n de credenciales (sin contraseÃ±as)..." rows="4"></textarea>

        <div class="ficha-actions">
          <button class="btn-ficha primary" id="btn-copy-ficha">ðŸ“‹ Copiar para Notas</button>
          <button class="btn-ficha secondary" id="btn-download-ficha">ðŸ“¥ Descargar TXT</button>
        </div>
      </div>`;

    const channels = document.getElementById("cctv-channels-list");
    for (let i = 1; i <= 32; i++) {
      channels.insertAdjacentHTML("beforeend", `
        <div class="grid-row channel-row">
          <span class="row-num">CH${i}</span>
          <input type="text" id="f-ch-name-${i}" placeholder="CÃ¡mara ${i}">
          <input type="text" id="f-ch-ip-${i}" placeholder="IP">
          <input type="text" id="f-ch-port-${i}" placeholder="Puerto">
        </div>`);
    }

    this.renderZones();

    container.querySelectorAll(".remote-check").forEach(chk => chk.addEventListener("change", e => {
      const input = document.getElementById(e.target.dataset.target);
      if (input) {
        input.disabled = !e.target.checked;
        if (!e.target.checked) input.value = "";
        else input.focus();
      }
    }));

    [
      ["f-cctv-cam-marca","f-cctv-cam-otro"],
      ["f-cctv-grab-marca","f-cctv-grab-otro"],
      ["f-alarm-marca","f-alarm-otro"]
    ].forEach(([selectId,inputId]) => {
      const select = document.getElementById(selectId), input = document.getElementById(inputId);
      const update = () => input.classList.toggle("visible", select.value === "Otros" || select.value === "Otro");
      select.addEventListener("change", update);
      update();
    });

    document.getElementById("btn-add-zone")?.addEventListener("click", () => {
      this.totalZones += 5;
      this.renderZones();
    });

    document.getElementById("btn-copy-ficha")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(this.generarTextoFicha());
        alert("âœ… Ficha copiada. PÃ©gala en Notas.");
      } catch {
        alert("No se pudo copiar automÃ¡ticamente. Usa Descargar TXT.");
      }
    });

    document.getElementById("btn-download-ficha")?.addEventListener("click", () => {
      const text = this.generarTextoFicha();
      const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ficha_${(this.value("f-cliente") || "Instalacion").replace(/[^a-z0-9_-]+/gi,"_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  },

  renderZones() {
    const box = document.getElementById("alarm-zones-list");
    if (!box) return;
    const old = {};
    for (let i=1;i<=this.totalZones;i++) {
      old[i] = {
        name: document.getElementById(`f-z-name-${i}`)?.value || "",
        detector: document.getElementById(`f-z-detector-${i}`)?.value || "VolumÃ©trico",
        zoneType: document.getElementById(`f-z-type-${i}`)?.value || "InstantÃ¡nea"
      };
    }
    box.innerHTML = "";
    const detectorTypes = ["VolumÃ©trico","MagnÃ©tico","Exterior","Cortina","Sombra","Humo / Incendio","Teclado / Sirena","Otro"];
    const zoneTypes = ["InstantÃ¡nea","Retardada","PÃ¡nico","24 horas","Incendio","Sabotaje","Exterior","Llave / Armado","TÃ©cnica","Otro"];
    for (let i=1;i<=this.totalZones;i++) {
      box.insertAdjacentHTML("beforeend", `
        <div class="zone-block">
          <div class="zone-title">Z${i}</div>
          <input type="text" id="f-z-name-${i}" placeholder="UbicaciÃ³n / detector">
          <select id="f-z-detector-${i}" class="styled-select compact">
            ${detectorTypes.map(x=>`<option>${x}</option>`).join("")}
          </select>
          <select id="f-z-type-${i}" class="styled-select compact">
            ${zoneTypes.map(x=>`<option>${x}</option>`).join("")}
          </select>
        </div>`);
      if (old[i]) {
        document.getElementById(`f-z-name-${i}`).value = old[i].name;
        document.getElementById(`f-z-detector-${i}`).value = old[i].detector;
        document.getElementById(`f-z-type-${i}`).value = old[i].zoneType;
      }
    }
  },

  value(id) { return document.getElementById(id)?.value?.trim() || "N/A"; },

  generarTextoFicha() {
    const v = id => this.value(id);
    const selected = (id, otherId) => {
      const val = v(id);
      return (val === "Otros" || val === "Otro") ? (v(otherId) === "N/A" ? val : v(otherId)) : val;
    };

    const remote = ["p2p","dns","vpn","otros"].map(k => {
      const chk = document.querySelector(`[data-target="${k}-input"]`);
      return chk?.checked ? `${k.toUpperCase()}: ${v(`${k}-input`)}` : null;
    }).filter(Boolean).join(" | ") || "Sin configuraciÃ³n remota";

    const channels = [];
    for (let i=1;i<=32;i++) {
      const name=v(`f-ch-name-${i}`);
      if (name !== "N/A") channels.push(`CH${i}: ${name} | IP: ${v(`f-ch-ip-${i}`)} | Puerto: ${v(`f-ch-port-${i}`)}`);
    }

    const zones=[];
    for (let i=1;i<=this.totalZones;i++) {
      const name=v(`f-z-name-${i}`);
      if (name !== "N/A") zones.push(`Z${i}: ${name} | Detector: ${v(`f-z-detector-${i}`)} | Tipo: ${v(`f-z-type-${i}`)}`);
    }

    return `========================================
FICHA TÃ‰CNICA DE INSTALACIÃ“N - A7 SEGURIDAD
========================================
FECHA: ${v("f-fecha")}
CLIENTE: ${v("f-cliente")}
UBICACIÃ“N: ${v("f-ubicacion")}

--- RED ---
IP: ${v("f-ip")}
GATEWAY: ${v("f-gateway")}
PUERTOS / SERVICIOS: ${v("f-puertos")}

--- CCTV ---
CÃMARAS: ${selected("f-cctv-cam-marca","f-cctv-cam-otro")}
GRABADOR: ${selected("f-cctv-grab-marca","f-cctv-grab-otro")}
TECNOLOGÃA: ${v("f-cctv-tipo")}
ACCESO REMOTO: ${remote}

--- CANALES CCTV ---
${channels.join("\n") || "Sin cÃ¡maras registradas."}

--- ALARMA ---
CENTRAL: ${selected("f-alarm-marca","f-alarm-otro")}

--- ZONAS ---
${zones.join("\n") || "Sin zonas registradas."}

--- OBSERVACIONES TÃ‰CNICAS ---
${v("f-observaciones")}

NOTA DE SEGURIDAD:
No se almacenan ni exportan contraseÃ±as desde esta ficha.
========================================`;
  },

  async openDetail(id) {
    const item = DataService.getById(id);
    if (!item) return;
    StorageService.addToHistory(id);

    const docs = Object.entries(item.documentos || {}).filter(([,url]) => url);
    const buttons = [];
    for (const [type,url] of docs) {
      const labels = {manual:"ðŸ“• Manual de usuario",instalacion:"ðŸ› ï¸ Manual de instalaciÃ³n",ficha:"âš™ï¸ Ficha tÃ©cnica",firmware:"ðŸ’¾ Firmware"};
      const offline = await this.isCached(url);
      buttons.push(`
        <div class="doc-row">
          <a href="${this.escape(url)}" target="_blank" rel="noopener noreferrer" class="doc-btn">${labels[type] || type}</a>
          <button class="offline-btn ${offline ? "downloaded" : ""}" data-offline-url="${this.escape(url)}">${offline ? "âœ“ Offline" : "â¬‡ Offline"}</button>
        </div>`);
    }
    if (item.fabricante) {
      buttons.push(`<a href="${this.escape(item.fabricante)}" target="_blank" rel="noopener noreferrer" class="doc-btn secondary">ðŸ”— Web del fabricante</a>`);
    }

    this.detailContent.innerHTML = `
      <div class="detail-header">
        <div class="detail-icon">${this.getIconForCategory(item.categoria)}</div>
        <div class="muted">${this.escape(item.categoria)} Â· ${this.escape(item.tipo)}</div>
        <h2>${this.escape(item.marca)} ${this.escape(item.modelo)}</h2>
        <p>${this.escape(item.descripcion || "")}</p>
        <div class="detail-tags">${(item.tags||[]).map(t=>`<span>${this.escape(t)}</span>`).join("")}</div>
      </div>
      <div class="detail-docs">${buttons.join("") || '<p class="empty-state">No hay documentos asociados.</p>'}</div>
      <button class="fav-btn-large ${StorageService.isFavorite(id) ? "is-fav":""}" id="btn-toggle-fav">
        ${StorageService.isFavorite(id) ? "â­ Quitar de favoritos" : "â˜† AÃ±adir a favoritos"}
      </button>`;

    document.getElementById("btn-toggle-fav")?.addEventListener("click", e => {
      const now = StorageService.toggleFavorite(id);
      e.currentTarget.classList.toggle("is-fav", now);
      e.currentTarget.textContent = now ? "â­ Quitar de favoritos" : "â˜† AÃ±adir a favoritos";
    });

    this.detailContent.querySelectorAll(".offline-btn").forEach(btn => btn.addEventListener("click", async e => {
      const url = e.currentTarget.dataset.offlineUrl;
      e.currentTarget.disabled = true;
      try {
        const ok = await this.toggleOffline(url);
        e.currentTarget.textContent = ok ? "âœ“ Offline" : "â¬‡ Offline";
        e.currentTarget.classList.toggle("downloaded", ok);
      } catch (err) {
        console.error(err);
        alert("No se pudo descargar para uso offline. Comprueba la conexiÃ³n.");
      } finally {
        e.currentTarget.disabled = false;
      }
    }));

    this.navigate("view-detail");
  },

  async isCached(path) {
    if (!("caches" in window)) return false;
    const url = new URL(path, location.href).href;
    const cache = await caches.open(MANUAL_CACHE);
    return !!(await cache.match(url));
  },

  async toggleOffline(path) {
    if (!("caches" in window)) throw new Error("Cache API no disponible");
    const url = new URL(path, location.href).href;
    const cache = await caches.open(MANUAL_CACHE);
    const existing = await cache.match(url);
    if (existing) {
      await cache.delete(url);
      return false;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await cache.put(url, response.clone());
    return true;
  },

  async clearAppCache() {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("a7-seguridad-")).map(k => caches.delete(k)));
    alert("CachÃ© de la aplicaciÃ³n limpiada. Recarga la pÃ¡gina para reinstalar el shell.");
  },

  loadTheme() {
    const theme = StorageService.getTheme();
    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.checked = theme === "dark";
    this.applyTheme(theme);
  },

  applyTheme(theme) {
    document.body.classList.toggle("dark-mode", theme === "dark");
    document.body.classList.toggle("light-mode", theme !== "dark");
  }
};

document.addEventListener("DOMContentLoaded", () => AppUI.init());
