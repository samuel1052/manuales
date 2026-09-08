/**
 * ARQUITECTURA PREPARADA PARA FASE 2:
 * Los servicios están desacoplados de la interfaz.
 */

// 1. Servicio de Almacenamiento (Fase 1: LocalStorage. Fase 2: API/Nube)
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
        history = history.filter(hId => hId !== id); // Quitar si existe
        history.unshift(id); // Añadir al principio
        if (history.length > 10) history.pop(); // Mantener solo 10
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

    // Buscador Avanzado (Ignora acentos, mayúsculas y busca en múltiples campos)
    static search(query, category = "", brand = "") {
        const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const q = normalize(query);

        return this.manuals.filter(m => {
            // Filtros exactos
            if (category && m.categoria !== category) return false;
            if (brand && m.marca !== brand) return false;

            // Búsqueda de texto libre
            if (!q) return true;
            
            const textToSearch = normalize(`${m.marca} ${m.modelo} ${m.categoria} ${m.tipo} ${m.descripcion} ${m.tags.join(' ')}`);
            return textToSearch.includes(q);
        });
    }
}

// 3. Controlador de UI
const AppUI = {
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
        this.mainSearch.addEventListener('focus', () => {
            this.navigate('view-search');
            this.secSearch.focus();
        });
        
        this.secSearch.addEventListener('input', () => this.renderSearch());
        this.filterCat.addEventListener('change', () => this.renderSearch());
        this.filterBrand.addEventListener('change', () => this.renderSearch());

        // Botones de categoría rápida
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterCat.value = btn.dataset.cat;
                this.navigate('view-search');
                this.renderSearch();
            });
        });

        // Modo Oscuro
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            StorageService.setTheme(theme);
            this.applyTheme(theme);
        });

        // Botón Volver de Ficha
        document.getElementById('btn-back').addEventListener('click', () => {
            this.navigate(this.lastView || 'view-home');
        });
    },

    async initializeApp() {
        await DataService.loadData();
        this.populateFilters();
        this.renderHome();
    },

    navigate(viewId) {
        if(viewId !== 'view-detail') this.lastView = viewId;
        
        this.views.forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');

        this.navItems.forEach(nav => {
            if (nav.dataset.target === viewId) nav.classList.add('active');
            else nav.classList.remove('active');
        });

        if (viewId === 'view-home') this.renderHome();
        if (viewId === 'view-favorites') this.renderFavoritesFull();
    },

    // Generadores de HTML
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

    // Renderizados de Vistas
    renderHome() {
        // Historial
        const histContainer = document.getElementById('recent-list');
        histContainer.innerHTML = '';
        const historyIds = StorageService.getHistory();
        if (historyIds.length === 0) histContainer.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No hay consultas recientes.</p>';
        historyIds.forEach(id => {
            const item = DataService.getById(id);
            if(item) histContainer.appendChild(this.createItemCard(item));
        });

        // Favoritos en Home (Max 3)
        const favContainer = document.getElementById('favorites-list-home');
        favContainer.innerHTML = '';
        const favIds = StorageService.getFavorites().slice(0, 3);
        if (favIds.length === 0) favContainer.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Aún no tienes favoritos.</p>';
        favIds.forEach(id => {
            const item = DataService.getById(id);
            if(item) favContainer.appendChild(this.createItemCard(item));
        });
    },

    populateFilters() {
        DataService.getCategories().forEach(cat => {
            this.filterCat.add(new Option(cat, cat));
        });
        DataService.getBrands().forEach(brand => {
            this.filterBrand.add(new Option(brand, brand));
        });
    },

    renderSearch() {
        const query = this.secSearch.value;
        const cat = this.filterCat.value;
        const brand = this.filterBrand.value;
        
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
        favContainer.innerHTML = '';
        const favIds = StorageService.getFavorites();
        if (favIds.length === 0) favContainer.innerHTML = '<p style="text-align:center; margin-top:20px; color:var(--text-muted);">Tu biblioteca está vacía.</p>';
        favIds.forEach(id => {
            const item = DataService.getById(id);
            if(item) favContainer.appendChild(this.createItemCard(item));
        });
    },

    openDetail(id) {
        const item = DataService.getById(id);
        if(!item) return;

        StorageService.addToHistory(id);

        const isFav = StorageService.isFavorite(id);
        const tagsHtml = item.tags.map(t => `<span>${t}</span>`).join('');
        
        let docsHtml = '';
        if(item.documentos.manual) docsHtml += `<a href="${item.documentos.manual}" target="_blank" class="doc-btn">📕 Manual de usuario</a>`;
        if(item.documentos.instalacion) docsHtml += `<a href="${item.documentos.instalacion}" target="_blank" class="doc-btn">🛠️ Manual de instalación</a>`;
        if(item.documentos.ficha) docsHtml += `<a href="${item.documentos.ficha}" target="_blank" class="doc-btn secondary">⚙️ Ficha técnica</a>`;
        if(item.documentos.firmware) docsHtml += `<a href="${item.documentos.firmware}" target="_blank" class="doc-btn secondary">💾 Firmware</a>`;
        if(item.fabricante) docsHtml += `<a href="${item.fabricante}" target="_blank" class="doc-btn secondary">🔗 Web del fabricante</a>`;

        this.detailContent.innerHTML = `
            <div class="detail-header">
                <div style="font-size:32px; margin-bottom:8px;">${this.getIconForCategory(item.categoria)}</div>
                <div style="color:var(--text-muted); font-size:14px;">${item.categoria} &gt; ${item.tipo}</div>
                <h2>${item.marca} ${item.modelo}</h2>
                <p>${item.descripcion}</p>
                <div class="detail-tags" style="margin-top:12px;">${tagsHtml}</div>
            </div>
            
            <div class="detail-docs">
                ${docsHtml}
            </div>

            <button class="fav-btn-large ${isFav ? 'is-fav' : ''}" id="btn-toggle-fav">
                ${isFav ? '⭐ Quitar de favoritos' : '☆ Añadir a favoritos'}
            </button>
        `;

        document.getElementById('btn-toggle-fav').addEventListener('click', (e) => {
            const isNowFav = StorageService.toggleFavorite(id);
            e.target.classList.toggle('is-fav', isNowFav);
            e.target.innerHTML = isNowFav ? '⭐ Quitar de favoritos' : '☆ Añadir a favoritos';
        });

        this.navigate('view-detail');
    },

    loadTheme() {
        const theme = StorageService.getTheme();
        document.getElementById('theme-toggle').checked = (theme === 'dark');
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

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => {
    AppUI.init();
});

// Registro del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registrado', reg))
            .catch(err => console.error('Error registrando Service Worker', err));
    });
}
