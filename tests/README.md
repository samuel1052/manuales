# Validación

Desde la raíz del repositorio:

- `node --check app.js` y `node --check sw.js`.
- `node tests/service-worker.cjs`: sin dependencias; simula instalación fallida/satisfactoria y conservación de la caché PDF.
- `node tests/form.cjs`: requiere `jsdom` (o `JSDOM_MODULE` con la ruta al módulo). Verifica conservación en memoria, incorporación de cámaras/zonas, exportación técnica, categorías, búsqueda, teclado, etiquetas, favoritos/historial/tema, copiar/TXT y descarga/eliminación PDF con APIs simuladas.
- `node tests/browser.cjs`: requiere Playwright y Chromium (o `PLAYWRIGHT_MODULE` con la ruta al módulo). Servir el repositorio en `http://localhost:8765`, o indicar `TEST_URL`. `SHOT_DIR` permite guardar capturas en un directorio existente. Incluye recarga offline con PDF real y comprobación de anchura a 320 px.

En esta entrega pasaron la sintaxis y las pruebas simuladas. La prueba de navegador no pudo arrancar: macOS rechazó Chromium con `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer: Permission denied (1100)`. Posteriormente se comprobó en el navegador integrado el arranque de la copia local con 14 equipos, la Ficha, conservación de cliente/IP/partición tras navegar y añadir equipos, ausencia de errores en consola y ancho de 320 px sin desbordamiento. Se realizó una inspección visual móvil. En la web publicada también se verificaron 14 equipos, Ficha y detalle de DoorProtect. Siguen pendientes Safari/iPhone, el portapapeles/descarga nativos y la recarga offline en navegador. Las comprobaciones de DOM y caché simuladas no sustituyen esas pruebas.

La versión nueva espera a que se cierren las páginas controladas por la versión anterior antes de activarse. Esto evita mezclar recursos y perder una ficha abierta. Los PDF permanecen en una caché independiente, y las carpetas/manuales pendientes no se modifican.

La revisión adicional cubre abrir Buscar durante una carga lenta, errores al leer CacheStorage, reinstalar un worker con la misma versión y navegación a JS/CSS/PDF ausentes.
