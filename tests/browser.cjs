// Requires Playwright. Run against http://localhost:8765 (or TEST_URL).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.TEST_URL||'http://localhost:8765');
 await page.waitForFunction(()=>DataService.manuals.length>0);
 await page.click('[data-target="view-ficha"]');
 await page.fill('#f-cliente','Cliente de prueba');await page.fill('#f-ch-1-ip','10.0.0.2');await page.fill('#f-ch-1-modelo','Modelo libre');
 await page.selectOption('#f-z-1-tipo','Pánico');await page.fill('#f-z-1-particion','2');
 await page.click('[data-target="view-home"]');await page.click('[data-target="view-ficha"]');await page.click('[data-target="view-ficha"]');
 assert.equal(await page.inputValue('#f-cliente'),'Cliente de prueba');
 await page.click('#btn-add-camera');await page.click('#btn-add-zone');
 assert.equal(await page.inputValue('#f-ch-1-ip'),'10.0.0.2');assert.equal(await page.inputValue('#f-z-1-particion'),'2');
 assert.equal(await page.locator('[data-camera]').count(),2);assert.equal(await page.locator('[data-zone]').count(),2);
 const txt=await page.evaluate(()=>AppUI.generarTextoFicha());
 assert(txt.includes('Modelo libre')&&txt.includes('10.0.0.2')&&txt.includes('Pánico')&&txt.includes('Partición: 2'));
 assert(!/N\/A|Dahua|Ajax|Cámara 2|Zona 2/.test(txt));
 await page.evaluate(()=>{document.querySelector('[data-target="dns-input"]').click();document.querySelector('#dns-input').value='ejemplo.test';});
 assert((await page.evaluate(()=>AppUI.generarTextoFicha())).includes('DDNS'));
 const downloadPromise=page.waitForEvent('download');await page.click('#btn-download-ficha');assert.equal((await downloadPromise).suggestedFilename(),'Ficha_Instalacion.txt');
 if(process.env.SHOT_DIR) await page.screenshot({path:process.env.SHOT_DIR+'/desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:700});if(process.env.SHOT_DIR) await page.screenshot({path:process.env.SHOT_DIR+'/mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.click('[data-target="view-home"]');
 for(const category of ['Control de Acceso','Electricidad','Otros']){
  await page.evaluate(()=>AppUI.filterBrand.value='Dahua');await page.click(`.cat-btn[data-cat="${category}"]`);
  assert.equal(await page.locator('#search-results .item-card').count(),0);assert.equal(await page.inputValue('#filter-brand'),'');assert((await page.textContent('#search-results')).includes('todavía no tiene equipos'));await page.click('[data-target="view-home"]');
 }
 await page.evaluate(()=>{DataService.manuals.push({id:'test',categoria:'Nueva categoría'});AppUI.populateFilters();});assert.equal(await page.locator('.cat-btn[data-cat="Nueva categoría"]').count(),1);
 await page.click('#header-action');assert(await page.locator('#view-more').evaluate(el=>el.classList.contains('active')));
 await page.click('[data-target="view-search"]');await page.selectOption('#filter-category','');await page.fill('#secondary-search','nvr');assert(await page.locator('#search-results .item-card').count()>0);
 await page.locator('#search-results .item-card').first().focus();await page.keyboard.press('Enter');assert(await page.locator('#view-detail').evaluate(el=>el.classList.contains('active')));
 await page.evaluate(()=>{StorageService.toggleFavorite('dahua-dhi-nvr5208-e12');StorageService.setTheme('dark');});
 await page.evaluate(()=>AppUI.toggleOffline('./manuales/alarmas/ajax/doorprotect/manual.pdf'));assert(await page.evaluate(()=>AppUI.isCached('./manuales/alarmas/ajax/doorprotect/manual.pdf')));
 await page.waitForFunction(()=>navigator.serviceWorker.controller);
 await page.evaluate(()=>AppUI.updateOnlineState());assert((await page.textContent('#offline-status')).includes('preparada para trabajar'));
 await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>DataService.manuals.length>0);
 assert(await page.evaluate(()=>StorageService.isFavorite('dahua-dhi-nvr5208-e12')));assert(await page.evaluate(()=>StorageService.getHistory().length>0));
 assert(await page.evaluate(()=>AppUI.isCached('./manuales/alarmas/ajax/doorprotect/manual.pdf')));
 assert(await page.evaluate(async()=>{const r=await fetch('./manuales/alarmas/ajax/doorprotect/manual.pdf');return r.ok&&(await r.blob()).size>0;}));
 await page.click('[data-target="view-ficha"]');assert.equal(await page.inputValue('#f-cliente'),'');
 assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).sort()),['biblioteca_favoritos','biblioteca_historial','biblioteca_tema']);
 await page.evaluate(()=>AppUI.clearPdfCache());assert.equal(await page.evaluate(()=>AppUI.isCached('./manuales/alarmas/ajax/doorprotect/manual.pdf')),false);
 assert.deepEqual(errors,[]);console.log('PASS: ficha, append, TXT, empty/new categories, keyboard, favorites/history/theme, explicit PDF download/removal, offline reload, 320px layout');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
