/**
 * ARQUITECTURA PREPARADA PARA FASE 2:
 * Los servicios están desacoplados de la interfaz.
 */

// 1. Servicio de Almacenamiento
class StorageService {
    static getFavorites() {
        return JSON.parse(localStorage.getItem('biblioteca_favoritos')) || [];
    }
    static toggleFavorite(id) {
        let favs = this.getFavorites();
        if (favs.includes(id)) {
            favs = favs.filter(fId => fId !== id);
        } else {
            favs.push(id);
        }
        localStorage.setItem('biblioteca_favoritos', JSON.stringify(favs));
        return favs.includes(id);
    }
    static isFavorite(id) {
        return this.getFavorites().includes(id);
    }
    
    static getHistory() {
        return JSON.parse(localStorage.getItem('biblioteca_historial')) || [];
    }
    static addToHistory(id) {
        let history = this.getHistory();
        history = history.filter(hId => hId !== id);
        history.unshift(id);
        if (history.length > 10) history.pop();
        localStorage.setItem('biblioteca_historial', JSON.stringify(history));
    }

    static getTheme() {
        return localStorage.getItem('biblioteca_tema') || 'light';
    }
    static setTheme(theme) {
        localStorage.setItem('biblioteca_tema', theme);
    }
}

// 2. Servicio de Datos
class DataService {
    static manuals = [];
    
    static async loadData() {
        try {
            const response = await fetch('manuales.json');
            this.manuals = await response.json();
            return true;
        } catch (error) {
            console.error("Error cargando manuales:", error);
            return false;
        }
    }

    static getAll() { return this.manuals; }
    
    static getById(id) {
        return this.manuals.find(m => m.id === id);
    }

    static getBrands() {
        const brands = [...new Set(this.manuals.map(m => m.marca))];
        return brands.sort();
    }

    static getCategories() {
        const cats = [...new Set(this.manuals.map(m => m.categoria))];
        return cats.sort();
    }

    static search(query, category = "", brand = "") {
        const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const q = normalize(query);

        return this.manuals.filter(m => {
            if (category && m.categoria !== category) return false;
            if (brand && m.marca !== brand) return false;
            if (!q) return true;
            
            const textToSearch = normalize(`${m.marca} ${m.modelo} ${m.categoria} ${m.tipo} ${m.descripcion} ${m.tags ? m.tags.join(' ') : ''}`);
            return textToSearch.includes(q);
        });
    }
}

// 3. Controlador de UI
const AppUI = {
    totalZones: 30,

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadTheme();
        this.initializeApp();
    },

    cacheDOM() {
        this.views = document.querySelectorAll('.view');
        this.navItems = document.querySelectorAll('.nav-item');
        this.mainSearch = document.getElementById('main-search');
        this.secSearch = document.getElementById('secondary-search');
        this.searchResults = document.getElementById('search-results');
        this.filterCat = document.getElementById('filter-category');
        this.filterBrand = document.getElementById('filter-brand');
        this.detailContent = document.getElementById('detail-content');
    },

    bindEvents() {
        // Navegación Inferior
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(item.dataset.target);
            });
        });

        // Buscadores
        if(this.mainSearch) {
            this.mainSearch.addEventListener('focus', () => {
                this.navigate('view-search');
                if(this.secSearch) this.secSearch.focus();
            });
        }
        
        if(this.secSearch) this.secSearch.addEventListener('input', () => this.renderSearch());
        if(this.filterCat) this.filterCat.addEventListener('change', () => this.renderSearch());
        if(this.filterBrand) this.filterBrand.addEventListener('change', () => this.renderSearch());

        // Botones de categoría rápida
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if(this.filterCat) this.filterCat.value = btn.dataset.cat;
                this.navigate('view-search');
                this.renderSearch();
            });
        });

        // Modo Oscuro
        const themeToggle = document.getElementById('theme-toggle');
        if(themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                const theme = e.target.checked ? 'dark' : 'light';
                StorageService.setTheme(theme);
                this.applyTheme(theme);
            });
        }

        // Botón Volver de Ficha
        const btnBack = document.getElementById('btn-back');
        if(btnBack) {
            btnBack.addEventListener('click', () => {
                this.navigate(this.lastView || 'view-home');
            });
        }
    },

    async initializeApp() {
        await DataService.loadData();
        this.populateFilters();
        this.renderHome();
    },

    navigate(viewId) {
        if(viewId !== 'view-detail') this.lastView = viewId;
        
        this.views.forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewId);
        if(targetView) targetView.classList.add('active');

        this.navItems.forEach(nav => {
            if (nav.dataset.target === viewId) nav.classList.add('active');
            else nav.classList.remove('active');
        });

        if (viewId === 'view-home') this.renderHome();
        if (viewId === 'view-favorites') this.renderFavoritesFull();
        if (viewId === 'view-ficha') this.renderFichaForm();
    },

    getIconForCategory(cat) {
        const icons = { 'Alarmas': '🔔', 'CCTV': '📹', 'Redes': '🌐', 'Control de Acceso': '🚪', 'Videoporteros': '📞', 'Electricidad': '⚡' };
        return icons[cat] || '🔧';
    },

    createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-left">
                <div class="item-icon">${this.getIconForCategory(item.categoria)}</div>
                <div class="item-card-info">
                    <h3>${item.marca} ${item.modelo}</h3>
                    <p>${item.tipo}</p>
                </div>
            </div>
            <div style="color: var(--primary);">➔</div>
        `;
        card.addEventListener('click', () => this.openDetail(item.id));
        return card;
    },

    renderHome() {
        const histContainer = document.getElementById('recent-list');
        if(histContainer) {
            histContainer.innerHTML = '';
            const historyIds = StorageService.getHistory();
            if (historyIds.length === 0) histContainer.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No hay consultas recientes.</p>';
            historyIds.forEach(id => {
                const item = DataService.getById(id);
                if(item) histContainer.appendChild(this.createItemCard(item));
            });
        }

        const favContainer = document.getElementById('favorites-list-home');
        if(favContainer) {
            favContainer.innerHTML = '';
            const favIds = StorageService.getFavorites().slice(0, 3);
            if (favIds.length === 0) favContainer.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Aún no tienes favoritos.</p>';
            favIds.forEach(id => {
                const item = DataService.getById(id);
                if(item) favContainer.appendChild(this.createItemCard(item));
            });
        }
    },

    populateFilters() {
        if(this.filterCat) {
            DataService.getCategories().forEach(cat => {
                this.filterCat.add(new Option(cat, cat));
            });
        }
        if(this.filterBrand) {
            DataService.getBrands().forEach(brand => {
                this.filterBrand.add(new Option(brand, brand));
            });
        }
    },

    renderSearch() {
        if(!this.searchResults) return;
        const query = this.secSearch ? this.secSearch.value : '';
        const cat = this.filterCat ? this.filterCat.value : '';
        const brand = this.filterBrand ? this.filterBrand.value : '';
        
        const results = DataService.search(query, cat, brand);
        this.searchResults.innerHTML = '';
        
        if(results.length === 0) {
            this.searchResults.innerHTML = '<p style="text-align:center; margin-top:20px; color:var(--text-muted);">No se encontraron resultados.</p>';
            return;
        }

        results.forEach(item => this.searchResults.appendChild(this.createItemCard(item)));
    },

    renderFavoritesFull() {
        const favContainer = document.getElementById('favorites-list-full');
        if(!favContainer) return;
        favContainer.innerHTML = '';
        const favIds = StorageService.getFavorites();
        if (favIds.length === 0) favContainer.innerHTML = '<p style="text-align:center; margin-top:20px; color:var(--text-muted);">Tu biblioteca está vacía.</p>';
        favIds.forEach(id => {
            const item = DataService.getById(id);
            if(item) favContainer.appendChild(this.createItemCard(item));
        });
    },

    renderFichaForm() {
        const container = document.getElementById('ficha-form-container');
        if(!container) return;

        this.totalZones = 30;

        container.innerHTML = `
            <div class="ficha-card">
                <h3>📋 Datos del Cliente / Obra</h3>
                <input type="text" id="f-cliente" placeholder="Cliente / Empresa">
                <input type="text" id="f-ubicacion" placeholder="Dirección / Ubicación">
                <input type="date" id="f-fecha" value="${new Date().toISOString().split('T')[0]}">

                <h3>🌐 Configuración de Red</h3>
                <input type="text" id="f-ip" placeholder="IP asignada (ej. 192.168.1.100)">
                <input type="text" id="f-gateway" placeholder="Puerta de enlace / Gateway (ej. 192.168.1.1)">
                <input type="text" id="f-puertos" placeholder="Puertos abiertos (ej. 80, 554, 8000)">

                <h3>📹 Sistema CCTV</h3>
                <div class="form-group">
                    <label>Marca de Cámaras:</label>
                    <select id="f-cctv-cam-marca" class="styled-select">
                        <option value="Dahua">Dahua</option>
                        <option value="Hikvision">Hikvision</option>
                        <option value="Vesta">Vesta</option>
                        <option value="Imou">Imou</option>
                        <option value="Otros">Otros</option>
                    </select>
                    <input type="text" id="f-cctv-cam-otro" placeholder="Especificar marca/modelo de cámara" style="display:none; margin-top:6px;">
                </div>

                <div class="form-group">
                    <label>Marca de Grabador:</label>
                    <select id="f-cctv-grab-marca" class="styled-select">
                        <option value="Dahua">Dahua</option>
                        <option value="Hikvision">Hikvision</option>
                        <option value="Vesta">Vesta</option>
                        <option value="Imou">Imou</option>
                        <option value="Otros">Otros</option>
                    </select>
                    <input type="text" id="f-cctv-grab-otro" placeholder="Especificar marca/modelo de grabador" style="display:none; margin-top:6px;">
                </div>

                <div class="form-group">
                    <label>Tecnología del Grabador:</label>
                    <select id="f-cctv-tipo" class="styled-select">
                        <option value="IP">IP</option>
                        <option value="HD">HD (Analógico / HDCVI / TVI)</option>
                    </select>
                </div>

                <h4>📹 Canales / Cámaras (32 Canales)</h4>
                <div class="table-container scrollable-box" id="cctv-channels-list"></div>

                <h3>🔔 Sistema de Alarmas</h3>
                <div class="form-group">
                    <label>Marca / Tipo de Central:</label>
                    <select id="f-alarm-marca" class="styled-select">
                        <option value="Ajax">Ajax</option>
                        <option value="Hikvision">Hikvision</option>
                        <option value="Vesta">Vesta</option>
                        <option value="DSC">DSC</option>
                        <option value="Risco">Risco</option>
                        <option value="Otro">Otro</option>
                    </select>
                    <input type="text" id="f-alarm-otro" placeholder="Especificar marca y modelo de central" style="display:none; margin-top:6px;">
                </div>

                <h4>🚨 Mapeo de Zonas</h4>
                <div class="table-container scrollable-box" id="alarm-zones-list"></div>
                <button type="button" class="btn-add" id="btn-add-zone">➕ Añadir más zonas</button>

                <h3>📝 Observaciones y Credenciales</h3>
                <textarea id="f-observaciones" placeholder="Claves de usuario, notas de acceso o pendientes..." rows="3"></textarea>

                <div class="ficha-actions">
                    <button class="btn-ficha primary" id="btn-copy-ficha">📋 Copiar para Notas</button>
                    <button class="btn-ficha secondary" id="btn-download-ficha">📥 Descargar (.txt)</button>
                </div>
            </div>
        `;

        // Generar 32 canales CCTV
        const cctvList = document.getElementById('cctv-channels-list');
        let channelsHtml = '';
        for (let i = 1; i <= 32; i++) {
            channelsHtml += `
                <div class="grid-row channel-row">
                    <span class="row-num">CH${i}</span>
                    <input type="text" id="f-ch-name-${i}" placeholder="Nombre cámara ${i}">
                    <input type="text" id="f-ch-ip-${i}" placeholder="IP">
                    <input type="text" id="f-ch-port-${i}" placeholder="Puerto">
                </div>
            `;
        }
        cctvList.innerHTML = channelsHtml;

        // Generar zonas iniciales de Alarma (30 zonas)
        this.renderZones();

        // Listeners para selects "Otros"
        const camSelect = document.getElementById('f-cctv-cam-marca');
        const camOtroInput = document.getElementById('f-cctv-cam-otro');
        camSelect.addEventListener('change', () => {
            camOtroInput.style.display = camSelect.value === 'Otros' ? 'block' : 'none';
        });

        const grabSelect = document.getElementById('f-cctv-grab-marca');
        const grabOtroInput = document.getElementById('f-cctv-grab-otro');
        grabSelect.addEventListener('change', () => {
            grabOtroInput.style.display = grabSelect.value === 'Otros' ? 'block' : 'none';
        });

        const alarmSelect = document.getElementById('f-alarm-marca');
        const alarmOtroInput = document.getElementById('f-alarm-otro');
        alarmSelect.addEventListener('change', () => {
            alarmOtroInput.style.display = alarmSelect.value === 'Otro' ? 'block' : 'none';
        });

        // Botón añadir más zonas
        document.getElementById('btn-add-zone')?.addEventListener('click', () => {
            this.totalZones += 5;
            this.renderZones();
        });

        // Evento Copiar al Portapapeles
        document.getElementById('btn-copy-ficha')?.addEventListener('click', () => {
            const texto = this.generarTextoFicha();
            navigator.clipboard.writeText(texto).then(() => {
                alert('✅ Ficha completa copiada al portapapeles. Abre Notas y pégala.');
            });
        });

        // Evento Descargar TXT
        document.getElementById('btn-download-ficha')?.addEventListener('click', () => {
            const texto = this.generarTextoFicha();
            const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const cliente = document.getElementById('f-cliente').value || 'Instalacion';
            link.download = `Ficha_${cliente.replace(/\s+/g, '_')}.txt`;
            link.click();
        });
    },

    renderZones() {
        const zonesList = document.getElementById('alarm-zones-list');
        if (!zonesList) return;

        // Guardar valores ya escritos antes de re-renderizar
        const currentVals = {};
        for (let i = 1; i <= this.totalZones; i++) {
            const name = document.getElementById(`f-z-name-${i}`)?.value;
            const type = document.getElementById(`f-z-type-${i}`)?.value;
            if (name || type) currentVals[i] = { name, type };
        }

        let zonesHtml = '';
        for (let i = 1; i <= this.totalZones; i++) {
            zonesHtml += `
                <div class="grid-row zone-row">
                    <span class="row-num">Z${i}</span>
                    <input type="text" id="f-z-name-${i}" placeholder="Ubicación / Detector Z${i}">
                    <select id="f-z-type-${i}" class="styled-select compact">
                        <option value="Volumétrico">Volumétrico</option>
                        <option value="Magnético">Magnético</option>
                        <option value="Exterior">Exterior</option>
                        <option value="Cortina">Cortina</option>
                        <option value="Sombra">Sombra</option>
                        <option value="Humo / Incendio">Humo / Incendio</option>
                        <option value="Teclado / Sirena">Teclado / Sirena</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
            `;
        }
        zonesList.innerHTML = zonesHtml;

        // Restaurar valores guardados
        Object.keys(currentVals).forEach(i => {
            if (document.getElementById(`f-z-name-${i}`)) document.getElementById(`f-z-name-${i}`).value = currentVals[i].name || '';
            if (document.getElementById(`f-z-type-${i}`)) document.getElementById(`f-z-type-${i}`).value = currentVals[i].type || 'Volumétrico';
        });
    },

    generarTextoFicha() {
        const getVal = id => document.getElementById(id)?.value || 'N/A';

        // Marca Cámaras
        let camMarca = getVal('f-cctv-cam-marca');
        if (camMarca === 'Otros') camMarca = getVal('f-cctv-cam-otro') || 'Otros';

        // Marca Grabador
        let grabMarca = getVal('f-cctv-grab-marca');
        if (grabMarca === 'Otros') grabMarca = getVal('f-cctv-grab-otro') || 'Otros';

        // Marca Alarma
        let alarmMarca = getVal('f-alarm-marca');
        if (alarmMarca === 'Otro') alarmMarca = getVal('f-alarm-otro') || 'Otro';

        // Recopilar Canales CCTV activos
        let canalesText = '';
        for (let i = 1; i <= 32; i++) {
            const name = getVal(`f-ch-name-${i}`);
            const ip = getVal(`f-ch-ip-${i}`);
            const port = getVal(`f-ch-port-${i}`);

            if (name !== 'N/A' && name.trim() !== '') {
                canalesText += `CH${i}: ${name} | IP: ${ip} | Puerto: ${port}\n`;
            }
        }
        if (!canalesText) canalesText = 'Sin canales registrados.\n';

        // Recopilar Zonas de Alarma activas
        let zonasText = '';
        for (let i = 1; i <= this.totalZones; i++) {
            const name = getVal(`f-z-name-${i}`);
            const type = getVal(`f-z-type-${i}`);

            if (name !== 'N/A' && name.trim() !== '') {
                zonasText += `Z${i}: ${name} (${type})\n`;
            }
        }
        if (!zonasText) zonasText = 'Sin zonas registradas.\n';

        return `========================================
FICHA TÉCNICA DE INSTALACIÓN - A7 SEGURIDAD
========================================
FECHA: ${getVal('f-fecha')}
CLIENTE: ${getVal('f-cliente')}
UBICACIÓN: ${getVal('f-ubicacion')}

--- RED E IP ---
IP ASIGNADA: ${getVal('f-ip')}
GATEWAY: ${getVal('f-gateway')}
PUERTOS: ${getVal('f-puertos')}

--- SISTEMA CCTV ---
CÁMARAS MARCA: ${camMarca}
GRABADOR MARCA: ${grabMarca}
TECNOLOGÍA GRABADOR: ${getVal('f-cctv-tipo')}

--- CANALES CCTV REGISTRADOS ---
${canalesText}
--- SISTEMA DE ALARMA ---
CENTRAL / MARCA: ${alarmMarca}

--- MAPEO DE ZONAS REGISTRADAS ---
${zonasText}
--- OBSERVACIONES Y CREDENCIALES ---
${getVal('f-observaciones')}
========================================`;
    },

    openDetail(id) {
        const item = DataService.getById(id);
        if(!item) return;

        StorageService.addToHistory(id);

        const isFav = StorageService.isFavorite(id);
        const tagsHtml = item.tags ? item.tags.map(t => `<span>${t}</span>`).join('') : '';
        
        let docsHtml = '';
        if(item.documentos) {
            if(item.documentos.manual) docsHtml += `<a href="${item.documentos.manual}" target="_blank" class="doc-btn">📕 Manual de usuario</a>`;
            if(item.documentos.instalacion) docsHtml += `<a href="${item.documentos.instalacion}" target="_blank" class="doc-btn">🛠️ Manual de instalación</a>`;
            if(item.documentos.ficha) docsHtml += `<a href="${item.documentos.ficha}" target="_blank" class="doc-btn secondary">⚙️ Ficha técnica</a>`;
            if(item.documentos.firmware) docsHtml += `<a href="${item.documentos.firmware}" target="_blank" class="doc-btn secondary">💾 Firmware</a>`;
        }
        if(item.fabricante) docsHtml += `<a href="${item.fabricante}" target="_blank" class="doc-btn secondary">🔗 Web del fabricante</a>`;

        this.detailContent.innerHTML = `
            <div class="detail-header">
                <div style="font-size:32px; margin-bottom:8px;">${this.getIconForCategory(item.categoria)}</div>
                <div style="color:var(--text-muted); font-size:14px;">${item.categoria} &gt; ${item.tipo}</div>
                <h2>${item.marca} ${item.modelo}</h2>
                <p>${item.descripcion || ''}</p>
                <div class="detail-tags" style="margin-top:12px;">${tagsHtml}</div>
            </div>
            
            <div class="detail-docs">
                ${docsHtml}
            </div>

            <button class="fav-btn-large ${isFav ? 'is-fav' : ''}" id="btn-toggle-fav">
                ${isFav ? '⭐ Quitar de favoritos' : '☆ Añadir a favoritos'}
            </button>
        `;

        const btnToggle = document.getElementById('btn-toggle-fav');
        if(btnToggle) {
            btnToggle.addEventListener('click', (e) => {
                const isNowFav = StorageService.toggleFavorite(id);
                e.target.classList.toggle('is-fav', isNowFav);
                e.target.innerHTML = isNowFav ? '⭐ Quitar de favoritos' : '☆ Añadir a favoritos';
            });
        }

        this.navigate('view-detail');
    },

    loadTheme() {
        const theme = StorageService.getTheme();
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.checked = (theme === 'dark');
        this.applyTheme(theme);
    },

    applyTheme(theme) {
        if(theme === 'dark') {
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');
        } else {
            document.body.classList.add('light-mode');
            document.body.classList.remove('dark-mode');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppUI.init();
});
