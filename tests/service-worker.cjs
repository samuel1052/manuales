// Run with node tests/service-worker.cjs. No dependencies required.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
async function scenario(fail) {
 const handlers = {}, stores = new Map([['a7-seguridad-shell-v1.2.0',new Map([['old',new Response('old')]])],['a7-seguridad-pdf-v1',new Map([['manual.pdf',new Response('pdf')]])]]);
 const cache = name => { if (!stores.has(name)) stores.set(name,new Map()); const data=stores.get(name); return {match:async key=>data.get(typeof key==='string'?key:key.url),put:async(key,value)=>data.set(typeof key==='string'?key:key.url,value)}; };
 const context={URL,Request,Response,console,caches:{open:async name=>cache(name),delete:async name=>stores.delete(name),keys:async()=>[...stores.keys()]},fetch:async request=>{const url=request.url||request; if(url.includes('missing.'))throw new Error('offline');if(fail&&url.includes('app.js'))return new Response('missing',{status:404});return new Response(url.endsWith('.json')?'[]':'content',{headers:{'content-type':url.includes('.js?')?'application/javascript':url.includes('.css?')?'text/css':'text/html'}});},self:{registration:{scope:'https://example.test/manuales/'},location:{origin:'https://example.test'},clients:{claim:async()=>{}},addEventListener:(name,handler)=>handlers[name]=handler}};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);
 let pending; handlers.install({waitUntil:p=>pending=p});
 if(fail){await assert.rejects(pending);assert(stores.has('a7-seguridad-shell-v1.2.0'));assert(!stores.has('a7-seguridad-shell-v1.3.0'));}
 else {await pending;handlers.activate({waitUntil:p=>pending=p});await pending;assert(!stores.has('a7-seguridad-shell-v1.2.0'));assert(stores.has('a7-seguridad-shell-v1.3.0'));}
 assert(stores.has('a7-seguridad-pdf-v1'));
 let response;handlers.fetch({request:{method:'GET',url:'https://example.test/missing.js',mode:'cors'},respondWith:p=>response=p});await assert.rejects(response);
 for(const suffix of ['js','css','pdf']) { handlers.fetch({request:{method:'GET',url:'https://example.test/manuales/missing.'+suffix,mode:'navigate'},respondWith:p=>response=p});await assert.rejects(response); }
 if(!fail){ const active=stores.get('a7-seguridad-shell-v1.3.0');context.fetch=async()=>{throw new Error('offline');};handlers.install({waitUntil:p=>pending=p});await pending;assert.equal(stores.get('a7-seguridad-shell-v1.3.0'),active); }
}
(async()=>{await scenario(true);await scenario(false);console.log('PASS: failed install preserves previous release and PDFs; successful activation removes only old shell; assets do not get HTML fallback');})().catch(error=>{console.error(error);process.exit(1);});
