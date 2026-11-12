'use strict';
const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bs=v=>'Bs '+Number(v||0).toFixed(2);
/* MegaBot Android instalable: Chrome/POCO, sin dependencias de terceros. */
let pwaInstallPrompt=null;
const pwaIsAndroid=/Android/i.test(navigator.userAgent||'');
function pwaIsStandalone(){
 return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone===true;
}
function updatePwaInstallButtons(){
 const visible=pwaIsAndroid&&!pwaIsStandalone();
 const login=$('#pwaLoginInstall'),banner=$('#pwaInstallBanner');
 if(login)login.classList.toggle('hidden',!visible);
 if(banner)banner.classList.toggle('hidden',!visible);
}
function showPwaGuide(){
 const overlay=$('#pwaInstallHelp');
 if(overlay){overlay.classList.remove('hidden');$('#pwaHelpClose')?.focus()}
}
function closePwaGuide(){$('#pwaInstallHelp')?.classList.add('hidden')}
window.addEventListener('beforeinstallprompt',event=>{
 if(!pwaIsAndroid)return;
 event.preventDefault();
 pwaInstallPrompt=event;
 updatePwaInstallButtons();
});
window.addEventListener('appinstalled',()=>{
 pwaInstallPrompt=null;
 updatePwaInstallButtons();
 const node=$('#pwaInstallHelp');if(node)node.classList.add('hidden');
});

const st={me:null,products:[],wholesale:[],sales:[],deliveries:[],jobs:[],notices:[],audit:[],page:'dashboard',selectedJob:null,galleryImages:[],lastNotification:null,ws:null,branchStocks:{},branchTransfers:[],supplierHistory:[],supplierAlerts:[],supplierAlertCount:null,supplierWatch:{items:[],alerts:[],pending_count:0,automatic_connection:false},catalogAdmin:[],catalogEditingId:null};
function csrf(){return decodeURIComponent((document.cookie.match(/(?:^|; )megabot_csrf=([^;]+)/)||[])[1]||'')}
async function api(path,opts={}){
 const method=opts.method||'GET';const headers=opts.headers||{};
 if(!['GET','HEAD'].includes(method))headers['X-CSRF-Token']=csrf();
 if(opts.body && !(opts.body instanceof FormData)) headers['Content-Type']='application/json';
 const r=await fetch('/api'+path,{credentials:'same-origin',...opts,headers});
 let body;try{body=await r.json()}catch{body={detail:'Error del servidor'}}
 if(!r.ok){if(r.status===401){showLogin()}throw Error(typeof body.detail==='string'?body.detail:JSON.stringify(body.detail||body))}
 return body;
}
function toast(text,bad=false){let t=$('#toast');t.textContent=text;t.style.borderColor=bad?'#fe6a87':'#e9b65a';t.classList.remove('hidden');clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.add('hidden'),4500)}
function showLogin(){$('#setup').classList.add('hidden');$('#login').classList.remove('hidden');$('#shell').classList.add('hidden')}
function showSetup(){$('#login').classList.add('hidden');$('#shell').classList.add('hidden');$('#setup').classList.remove('hidden')}
function showApp(){$('#setup').classList.add('hidden');$('#login').classList.add('hidden');$('#shell').classList.remove('hidden');$('#adminName').textContent=st.me.display_name;$('#adminAvatar').textContent=st.me.display_name?.[0]?.toUpperCase()||'A';navigate('dashboard')}
let refreshInFlight=null;
async function refresh(){
 if(!st.me)return;
 if(refreshInFlight)return refreshInFlight;
 refreshInFlight=refreshOnce();
 try{return await refreshInFlight}finally{refreshInFlight=null}
}
async function refreshOnce(){
 if(!st.me)return;
 // Las consultas se realizan en pares para no saturar Supabase Free.
 // Si una falla, las demás siguen cargando y la pantalla no se queda bloqueada.
 const paths=['/products','/wholesale','/sales','/deliveries','/jobs','/notifications','/dashboard','/supplier/history','/supplier/alerts','/supplier/watch'];
 const previous=[st.products,st.wholesale,st.sales,st.deliveries,st.jobs,st.notices,st.dashboard||{},st.supplierHistory,
   {items:st.supplierAlerts,pending_count:st.supplierAlertCount||0},st.supplierWatch];
 const responses=[];
 let partial=false;
 for(let i=0;i<paths.length;i+=2){
  const group=await Promise.allSettled(paths.slice(i,i+2).map(path=>api(path)));
  group.forEach((result,j)=>{
   if(result.status==='fulfilled')responses.push(result.value);
   else{
    partial=true;console.warn('Sincronización parcial de '+paths[i+j],result.reason);
    responses.push(previous[i+j]);
   }
  });
 }
 const [products,wholesale,sales,deliveries,jobs,notices,dashboard,supplierHistory,supplierAlertFeed,supplierWatchFeed]=responses;
 try{
  const location=await api('/branches/lapaz');
  st.branchStocks=location.stocks||{};
  st.branchTransfers=location.transfers||[];
 }catch(err){
  partial=true;
  console.warn('Sucursal La Paz: sincronización pendiente',err);
 }
 const oldSupplierCount=st.supplierAlertCount;
 const old=st.lastNotification;
 st.products=products;st.wholesale=wholesale;st.sales=sales;
 st.deliveries=deliveries;st.jobs=jobs;st.notices=notices;
 st.dashboard=dashboard;st.supplierHistory=supplierHistory;
 st.supplierAlerts=supplierAlertFeed.items||[];
 st.supplierAlertCount=Number(supplierAlertFeed.pending_count||0);
 st.supplierWatch=supplierWatchFeed||{items:[],alerts:[],pending_count:0,automatic_connection:false};
 const conn=$('#conn');
 if(conn)conn.textContent=partial?'● Sincronización parcial':'● Sincronizado';
 if(oldSupplierCount!==null&&st.supplierAlertCount>oldSupplierCount){
  const delta=st.supplierAlertCount-oldSupplierCount;
  toast(delta+' novedad(es) de importadora. Revisa tus publicaciones en Facebook.');
  if(window.Notification&&Notification.permission==='granted'){
   try{new Notification('MegaBot · Alertas importadora',{body:delta+' cambios nuevos por revisar en tus productos.'})}catch{}
  }
 }
 const newest=notices[0]?.id||0;
 if(old!==null&&newest>old&&notices[0]){
  toast(notices[0].message);
  if(window.Notification&&Notification.permission==='granted'){
   try{new Notification('MegaBot • Notificación',{body:notices[0].message})}catch{}
  }
 }
 st.lastNotification=newest;
 render();
 if(partial&&st.me){
  console.info('MegaBot permanece disponible. Las consultas fallidas se reintentarán automáticamente.');
 }
}

function navigate(page){st.page=page;$$('.page').forEach(e=>e.classList.toggle('hidden',e.id!=='page-'+page));$$('.nav').forEach(e=>e.classList.toggle('active',e.dataset.page===page));let txt=$(`.nav[data-page="${page}"] span`);$('#crumb').textContent=txt?.textContent||'Panel principal';$('.sidebar').classList.remove('open');render();if(page==='catalog-editor')loadCatalogAdmin();}
function render(){if(!st.me)return; renderMetrics();renderProducts();renderSupplier();renderSupplierWatch();renderSupplierAlerts();renderSupplierHistory();renderInventory();renderBranches();renderSales();renderDeliveries();renderJobs();renderOptions();renderNotifications();renderAudit();}
/* Catálogo público: solo el administrador habilita los artículos y define los precios finales. */
async function loadCatalogAdmin(){
 const list=$('#catalogProductList');
 if(!list)return;
 $('#catalogListSummary').textContent='Cargando productos del catálogo…';
 try{
  st.catalogAdmin=await api('/catalogo/admin');
  renderCatalogList();
  if(st.catalogEditingId){
   const current=st.catalogAdmin.find(x=>x.product_id===st.catalogEditingId);
   if(current)fillCatalogEditor(current);
  }
 }catch(e){
  console.warn('No se pudieron cargar las configuraciones públicas',e);
  $('#catalogListSummary').textContent='No se pudo consultar el catálogo: '+e.message;
  list.innerHTML='';
 }
}
function renderCatalogList(){
 const list=$('#catalogProductList');if(!list)return;
 const rows=st.catalogAdmin||[];
 const published=rows.filter(x=>x.published).length;
 $('#catalogStats').innerHTML=[
  ['Productos registrados',rows.length],['Publicados para clientes',published],['Sin publicar',rows.length-published]
 ].map(([label,value])=>'<div class="inventory-kpi"><strong>'+value+'</strong><small>'+esc(label)+'</small></div>').join('');
 const text=($('#catalogFind').value||'').trim().toLowerCase();
 const filter=$('#catalogVisibility').value;
 const matches=rows.filter(p=>
  (filter==='all'||(filter==='published'&&p.published)||(filter==='hidden'&&!p.published)) &&
  (!text||(p.name+' '+p.sku+' '+p.category).toLowerCase().includes(text))
 );
 $('#catalogListSummary').textContent=matches.length+' coincidencias · '+published+' visibles al público';
 list.innerHTML=matches.map(p=>{
  const photo=p.photos?.[0];
  const image=photo?
   '<img loading="lazy" class="catalog-list-photo" src="'+esc(photo.url)+'" alt="'+esc(p.name)+'">':
   '<span class="catalog-list-photo catalog-no-photo">Sin foto</span>';
  return '<div class="list-item catalog-list-item '+(p.product_id===st.catalogEditingId?'active':'')+'">'+
   image+'<div class="catalog-list-body"><strong>'+esc(p.name)+'</strong>'+
   '<small>'+esc(p.sku)+' · '+esc(p.category||'Otros')+'</small>'+
   '<small>'+(p.published?'<span class="catalog-published">● Público</span>':'<span class="catalog-private">○ Sin publicar</span>')+
   ' · '+p.photos.length+' foto(s)'+
   (p.price_unit!==null?' · Bs '+Number(p.price_unit).toFixed(2):' · Sin precio público')+'</small></div>'+
   '<button type="button" class="mini" data-catalog-edit="'+p.product_id+'">Configurar</button></div>';
 }).join('')||'<p class="dim">No hay productos con ese filtro.</p>';
}
function fillCatalogEditor(p){
 st.catalogEditingId=p.product_id;
 $('#catalogProductId').value=p.product_id;
 $('#catalogSelectedLabel').textContent=p.name+' · '+p.sku;
 const photo=p.photos?.[0];
 $('#catalogSelectedPhoto').innerHTML=photo?
  '<img src="'+esc(photo.url)+'" alt="'+esc(p.name)+'">':
  '<span>Primero agrega una fotografía desde el inventario de MegaBot.</span>';
 const values={
  '#catalogPriceUnit':p.price_unit,'#catalogPriceThree':p.price_three,
  '#catalogPriceDozen':p.price_dozen,'#catalogPriceCase':p.price_case,
  '#catalogCaseUnits':p.case_units,'#catalogDisplayUnits':p.available_units
 };
 for(const [selector,value] of Object.entries(values))$(selector).value=value===null?'':String(value);
 $('#catalogAvailable').checked=p.available;
 $('#catalogPublish').checked=p.published;
 $('#catalogUnitHint').textContent='Precio actual de venta en MegaBot: Bs '+Number(p.sale_price_existing).toFixed(2)+
  '. Usa ese precio como referencia o escribe uno distinto para el catálogo público.';
 $('#catalogCaseHint').textContent=p.case_units&&p.price_case?
  'Cada cajón de '+p.case_units+' unidades cuesta Bs '+Number(p.price_case).toFixed(2)+
  ' (equivale a Bs '+(Number(p.price_case)/Number(p.case_units)).toFixed(2)+' por unidad).':
  'El precio por cajón corresponde al total del cajón. Indica también cuántas piezas contiene.';
 renderCatalogList();
 $('#catalogEditorPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function catalogNullableNumber(selector){
 const raw=$(selector).value.trim();
 return raw===''?null:Number(raw);
}
function catalogFormData(){
 return {
  published:$('#catalogPublish').checked,available:$('#catalogAvailable').checked,
  available_units:catalogNullableNumber('#catalogDisplayUnits'),
  price_unit:catalogNullableNumber('#catalogPriceUnit'),
  price_three:catalogNullableNumber('#catalogPriceThree'),
  price_dozen:catalogNullableNumber('#catalogPriceDozen'),
  case_units:catalogNullableNumber('#catalogCaseUnits'),
  price_case:catalogNullableNumber('#catalogPriceCase')
 };
}

function renderMetrics(){let x=st.dashboard||{};let metrics=[['▤','Productos activos',x.products||0],['◆','Ventas confirmadas',bs(x.sales_total)],['✧','Ganancia estimada',bs(x.profit_total)],['◈','Imágenes terminadas',x.images||0],['▣','Unidades disponibles',st.products.reduce((acc,p)=>acc+Number(p.stock||0)+Number(st.branchStocks[p.id]||0),0)],['◉','Capital en stock',bs(st.products.reduce((acc,p)=>acc+(Number(p.stock||0)+Number(st.branchStocks[p.id]||0))*Number(p.purchase_cost||0),0))],['◷','Saldo por cobrar',bs(x.pending_balance)],['✦','Lotes en progreso',x.jobs_running||0]];
 $('#metrics').innerHTML=metrics.map(a=>`<div class="metric"><div class="icon">${a[0]}</div><strong>${esc(a[2])}</strong><span>${esc(a[1])}</span></div>`).join('');
 $('#homeSales').innerHTML=st.sales.slice(0,4).map(s=>`<div class="list-item"><div><strong>Venta #${s.id} · ${esc(s.client)}</strong><small>${esc(s.created_at.slice(0,16).replace('T',' '))}</small></div><strong>${bs(s.total)}</strong></div>`).join('')||'<p>Sin ventas registradas.</p>';
 $('#homeJobs').innerHTML=st.jobs.slice(0,4).map(j=>jobRow(j,false)).join('')||'<p>Sin lotes de imágenes.</p>';
 renderBranchFinance();
}
function renderProducts(){let q=($('#searchProducts').value||'').toLowerCase();const wholesaleIds=new Set(st.wholesale.map(w=>w.product_id));let filtered=st.products.filter(p=>p.home_location!=='lapaz'&&!wholesaleIds.has(p.id)&&(p.name+' '+p.sku).toLowerCase().includes(q)).sort((a,b)=>a.id-b.id);
 $('#productCards').innerHTML=filtered.map(p=>`<article class="product-card">${p.photos.length?`<img src="${p.photos[0].url}" alt="Fotografía del producto">`:'<div class="product-placeholder">▤</div>'}<div class="product-name">${esc(p.name)}</div>${p.supplier_status==='agotado'?'<div class="supplier-unavailable">AGOTADO EN IMPORTADORA · stock propio conservado</div>':p.supplier_stock!=null?'<div class="supplier-available">Importadora: '+p.supplier_stock+' ud. · '+(p.supplier_unit_price==null?'Precio proveedor pendiente':bs(p.supplier_unit_price))+' / unidad · no es stock propio</div>':''}<div class="product-meta"><span>${esc(p.sku)}</span><span>${esc(p.category)}</span></div><div class="product-meta"><span>Stock: ${p.stock}</span><span>${p.photos.length} fotos</span></div><div class="product-price">${bs(p.sale_price)}</div><div class="product-meta"><span>Costo privado: ${bs(p.purchase_cost)}</span><span>${p.active?'Activo':'Archivado'}</span></div><div class="product-actions"><button class="mini" data-edit="${p.id}">Editar / fotos</button><button class="mini" data-ad="${p.id}">Crear anuncio</button><button class="mini" data-gen="${p.id}">50 imágenes</button><button class="mini supplier-toggle" data-supplier-toggle="${p.id}" title="Solo cambia disponibilidad del proveedor, no el stock propio">${p.supplier_status==='agotado'?'Disponible en importadora':'Agotado en importadora'}</button>${p.active?`<button class="mini danger" data-archive="${p.id}">Archivar</button>`:''}</div></article>`).join('')||'<p>No hay productos. Usa «Nuevo producto» para registrar el primero.</p>';}

function renderSupplier(){
 const root=$('#supplierList');if(!root)return;
 const query=($('#supplierSearch').value||'').trim().toLowerCase();
 const filter=$('#supplierFilter').value;
 const captured=st.products.filter(p=>p.supplier_stock!==null && p.supplier_stock!==undefined);
 const unavailable=st.products.filter(p=>p.supplier_status==='agotado');
 const totalQty=captured.reduce((sum,p)=>sum+Number(p.supplier_stock||0),0);
 $('#supplierSummary').textContent=captured.length+' productos con cantidades de importadora · '+totalQty+
   ' unidades anunciadas por proveedor (NO son stock propio) · '+unavailable.length+' agotados en proveedor.';
 const selected=st.products.filter(p=>{
   if(!(p.name+' '+p.sku+' '+p.category).toLowerCase().includes(query))return false;
   if(filter==='captured')return p.supplier_stock!==null && p.supplier_stock!==undefined;
   if(filter==='agotado')return p.supplier_status==='agotado';
   if(filter==='pending')return p.supplier_stock===null || p.supplier_stock===undefined;
   if(filter==='review')return Boolean(p.supplier_review_note);
   return true;
 }).sort((a,b)=>a.id-b.id);
 root.innerHTML=selected.map(p=>{
   const photo=p.photos.length?'<img class="supplier-photo" loading="lazy" src="'+p.photos[0].url+'" alt="Foto de producto">':
      '<div class="supplier-photo supplier-no-photo">Sin foto</div>';
   const qty=p.supplier_stock==null?'Por confirmar':p.supplier_stock+' ud.';
   const price=p.supplier_unit_price==null?'Por confirmar':bs(p.supplier_unit_price);
   const state=p.supplier_status==='agotado'?'<span class="supplier-unavailable">Agotado en proveedor</span>':
       p.supplier_stock==null?'<span class="dim">Sin datos recientes</span>':'<span class="supplier-available">Disponible en proveedor</span>';
   const ownStore=Number(p.stock||0),ownPaz=Number(st.branchStocks[p.id]||0);
   return '<div class="list-item supplier-list-item"><div class="supplier-row">'+photo+
     '<div class="supplier-row-body"><strong>'+esc(p.name)+'</strong><small>'+esc(p.sku)+' · '+esc(p.category)+'</small>'+
     '<small>Importadora: <b>'+qty+'</b> · Precio por unidad: <b>'+price+'</b></small>'+
     '<div class="supplier-tags"><span class="supplier-tag">Importadora</span><span class="supplier-tag">Tienda: '+ownStore+'</span><span class="supplier-tag">La Paz: '+ownPaz+'</span></div>'+
     '<small>Stock propio total: '+(ownStore+ownPaz)+' unidades</small>'+
     (p.supplier_review_note?'<div class="supplier-review-note">⚠ '+esc(p.supplier_review_note)+'</div>':'')+
     '<div>'+state+'</div></div></div>'+
     '<button type="button" class="mini" data-supplier-edit="'+p.id+'">Editar proveedor</button></div>';
 }).join('')||'<p class="dim">No se encontraron productos con esos filtros.</p>';
}




/* Información de la importadora de WhatsApp, totalmente independiente de MegaCompra. */
function renderSupplierWatch(){
 const data=st.supplierWatch||{items:[],alerts:[],pending_count:0};
 const rows=data.items||[],alerts=data.alerts||[],pending=Number(data.pending_count||0);
 const bubble=$('#supplierWatchNavCount');
 if(bubble){bubble.textContent=pending>99?'99+':String(pending);bubble.classList.toggle('hidden',!pending)}
 const listed=rows.filter(p=>p.listed),removed=rows.filter(p=>!p.listed);
 const metric=$('#supplierWatchMetrics');
 if(metric)metric.innerHTML=[
  ['Productos observados',rows.length],
  ['En catálogo proveedor',listed.length],
  ['Retirados del catálogo',removed.length],
  ['Alertas pendientes',pending],
 ].map(([label,num])=>'<div class="inventory-kpi"><strong>'+num+'</strong><small>'+esc(label)+'</small></div>').join('');
 const updated=data.last_imported_at?new Date(data.last_imported_at).toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'}):'sin registros';
 const conn=$('#supplierWatchConnection');
 if(conn)conn.textContent='Consulta automática de WhatsApp: NO conectada. Última captura registrada: '+updated+'. Los datos no se actualizan por sí solos.';
 const term=($('#supplierWatchSearch')?.value||'').trim().toLocaleLowerCase('es');
 const filter=$('#supplierWatchFilter')?.value||'all';
 const shown=rows.filter(p=>(filter==='all'||(filter==='listed'&&p.listed)||(filter==='removed'&&!p.listed))&&
    (!term||(p.title+' '+p.external_id).toLocaleLowerCase('es').includes(term)));
 const count=$('#supplierWatchListCount');
 if(count)count.textContent=shown.length+' de '+rows.length+' productos';
 const target=$('#supplierWatchItems');
 if(target)target.innerHTML=shown.slice(0,150).map(p=>{
  const price=p.base_price==null?'No informado':bs(p.base_price);
  const qty=p.available_units==null?'No informada':p.available_units+' unidades';
  const tag=p.listed?'<span class="supplier-available">En catálogo del proveedor</span>':'<span class="supplier-unavailable">Retirado del catálogo</span>';
  return '<div class="list-item supplier-watch-row"><div><strong>'+esc(p.title)+'</strong>'+
   '<small>Precio base: <b>'+esc(price)+'</b> · Cantidad del proveedor: <b>'+esc(qty)+'</b></small>'+
   '<small>'+tag+' · Referencia externa: '+esc(p.external_id)+'</small></div></div>';
 }).join('')+(shown.length>150?'<p class="dim">Mostrando 150 productos. Utiliza la búsqueda para encontrar otro.</p>':'')||
 '<p class="dim">Todavía no se ha importado una captura verificable de este proveedor.</p>';
 const alertCount=$('#supplierWatchAlertCount');
 if(alertCount)alertCount.textContent=pending+' sin revisar';
 const kinds={nuevo:'Producto nuevo',retirado:'Retirado del proveedor',repuesto:'Regresó al catálogo',precio:'Cambio de precio base',cantidad:'Cambio de unidades',titulo:'Cambio de título'};
 const out=$('#supplierWatchAlerts');
 if(out)out.innerHTML=alerts.filter(a=>!a.reviewed_at).slice(0,150).map(a=>{
  let detail='';
  if(a.kind==='precio')detail='Precio base: '+(a.old_base_price==null?'sin dato':bs(a.old_base_price))+' → '+(a.new_base_price==null?'sin dato':bs(a.new_base_price));
  else if(a.kind==='cantidad')detail='Unidades del proveedor: '+(a.old_available_units==null?'sin dato':a.old_available_units)+' → '+(a.new_available_units==null?'sin dato':a.new_available_units);
  else if(a.kind==='titulo')detail='Antes: '+(a.old_title||'sin título');
  else detail='Precio: '+(a.new_base_price==null?'sin dato':bs(a.new_base_price))+' · Cantidad: '+(a.new_available_units==null?'sin dato':a.new_available_units);
  const d=new Date(a.created_at);
  const date=Number.isNaN(d.getTime())?'':d.toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'});
  return '<div class="list-item supplier-watch-event"><div><small>'+esc(kinds[a.kind]||a.kind)+' · '+esc(date)+'</small>'+
   '<strong>'+esc(a.title)+'</strong><small>'+esc(detail)+'</small></div>'+
   '<button class="mini" type="button" data-supplier-watch-review="'+a.id+'">✓ Revisada</button></div>';
 }).join('')||'<p class="dim">No hay cambios pendientes. La consulta automática sigue sin conexión.</p>';
}

const SUPPLIER_ALERT_TYPES={
 nuevo:{name:'Nuevo en importadora',icon:'✦',tone:'new',action:'Revisa si ya publicaste este producto en Facebook. Si decides venderlo, prepara foto y precio de venta antes de publicarlo.'},
 agotado:{name:'Agotado en importadora',icon:'●',tone:'out',action:'Revisa tu anuncio en Facebook Marketplace y actualiza o pausa la publicación si dependes del proveedor. Si tienes stock propio puedes seguir vendiendo esas unidades.'},
 repuesto:{name:'Volvió a estar disponible',icon:'↻',tone:'restocked',action:'Comprueba la reposición del proveedor y considera reactivar el anuncio. Verifica existencias reales antes de ofrecer entrega inmediata.'},
 precio_subio:{name:'Subió el precio proveedor',icon:'↑',tone:'priceup',action:'Revisa tu margen de ganancia y el precio anunciado en Facebook. MegaBot no cambia automáticamente tu precio de venta.'},
 precio_bajo:{name:'Bajó el precio proveedor',icon:'↓',tone:'pricedown',action:'Puedes valorar una promoción o mejorar el margen. Confirma el nuevo precio con la importadora antes de cambiar Facebook.'}
};

function renderSupplierAlerts(){
 const area=$('#supplierAlertsList');if(!area)return;
 const all=st.supplierAlerts||[];
 const pending=Number(st.supplierAlertCount||0);
 const bubble=$('#supplierAlertNavCount');
 if(bubble){
  bubble.textContent=pending>99?'99+':String(pending);
  bubble.classList.toggle('hidden',pending===0);
 }
 const open=all.filter(a=>!a.reviewed_at);
 const stats=[
  ['Pendientes',pending,'pending'],
  ['Productos nuevos',open.filter(a=>a.kind==='nuevo').length,'new'],
  ['Agotados',open.filter(a=>a.kind==='agotado').length,'out'],
  ['Precios subieron',open.filter(a=>a.kind==='precio_subio').length,'priceup'],
  ['Precios bajaron',open.filter(a=>a.kind==='precio_bajo').length,'pricedown'],
  ['Reposiciones',open.filter(a=>a.kind==='repuesto').length,'restocked']
 ];
 $('#supplierAlertMetrics').innerHTML=stats.map(([label,n,tone])=>
  '<div class="supplier-alert-stat '+tone+'"><strong>'+n+'</strong><small>'+esc(label)+'</small></div>'
 ).join('');
 const state=$('#supplierAlertStatusFilter').value;
 const kind=$('#supplierAlertTypeFilter').value;
 const query=($('#supplierAlertSearch').value||'').toLowerCase().trim();
 const matches=all.filter(a=>{
  if(state==='pending'&&a.reviewed_at)return false;
  if(state==='reviewed'&&!a.reviewed_at)return false;
  if(kind!=='all'&&a.kind!==kind)return false;
  if(query && !(a.product_name+' '+a.sku).toLowerCase().includes(query))return false;
  return true;
 });
 $('#supplierAlertResultsLabel').textContent=matches.length+' alerta(s) mostradas · '+pending+' pendiente(s) por gestionar en Facebook.';
 const showQty=v=>v==null?'sin dato':v+' ud.';
 const showMoney=v=>v==null?'sin dato':bs(v);
 area.innerHTML=matches.map(a=>{
  const type=SUPPLIER_ALERT_TYPES[a.kind]||{name:'Cambio proveedor',icon:'◈',tone:'',action:'Revisa el producto y tu publicación.'};
  const prod=st.products.find(p=>p.id===a.product_id);
  const photo=prod?.photos?.length?'<img class="supplier-alert-photo" loading="lazy" alt="Producto" src="'+esc(prod.photos[0].url)+'">':'<div class="supplier-alert-photo supplier-alert-photo-empty">Sin foto</div>';
  const ownStore=Number(prod?.stock||0);
  const ownPaz=Number(st.branchStocks[a.product_id]||0);
  const time=new Date(a.created_at);
  const when=Number.isNaN(time.getTime())?'Fecha pendiente':time.toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'});
  const showPrice=(a.kind==='precio_subio'||a.kind==='precio_bajo')?
   '<div class="supplier-alert-delta">Precio proveedor: '+esc(showMoney(a.old_supplier_unit_price))+' → <strong>'+esc(showMoney(a.new_supplier_unit_price))+'</strong>'+
   (Number(a.old_supplier_unit_price)>0?' ('+((Number(a.new_supplier_unit_price)/Number(a.old_supplier_unit_price)-1)*100).toFixed(1)+'%)':'')+'</div>':
   '<div class="supplier-alert-delta">Importadora: '+esc(showQty(a.old_supplier_stock))+' → <strong>'+esc(showQty(a.new_supplier_stock))+'</strong> · Precio: '+esc(showMoney(a.new_supplier_unit_price))+'</div>';
  return '<article class="supplier-alert-card '+type.tone+(a.reviewed_at?' reviewed':'')+'">'+
    photo+'<div class="supplier-alert-main">'+
    '<div class="supplier-alert-heading"><span class="supplier-alert-kind">'+type.icon+' '+esc(type.name)+'</span>'+
    '<small>'+esc(when)+'</small></div>'+
    '<strong class="supplier-alert-product">'+esc(a.product_name)+'</strong>'+
    '<small class="supplier-alert-sku">'+esc(a.sku)+'</small>'+
    showPrice+
    '<p class="supplier-alert-advice">'+esc(type.action)+'</p>'+
    '<small class="supplier-alert-ownstock">Existencias propias: Tienda '+ownStore+' · La Paz '+ownPaz+' (no son las unidades de la importadora)</small>'+
    (prod?'<small class="supplier-alert-ownstock">Precio público actual: '+bs(prod.sale_price)+' · Costo real de compra propio: '+bs(prod.purchase_cost)+'</small>':'')+
    '<div class="supplier-alert-actions">'+
      '<button type="button" class="mini" data-supplier-alert-catalog="'+a.id+'">Ver producto</button>'+
      '<button type="button" class="mini" data-supplier-alert-copy="'+a.id+'">Copiar recordatorio</button>'+
      '<button type="button" class="mini '+(a.reviewed_at?'':'supplier-alert-done')+'" data-supplier-alert-review="'+a.id+'">'+
       (a.reviewed_at?'Volver a pendiente':'✓ Marcar revisada')+'</button>'+
    '</div></div></article>';
 }).join('')||'<p class="dim">No tienes alertas con este filtro. ¡Tus publicaciones están al día con los cambios registrados!</p>';
}

function renderSupplierHistory(){
 const target=$('#supplierHistoryList');if(!target)return;
 const query=($('#supplierHistorySearch').value||'').trim().toLowerCase();
 const all=st.supplierHistory||[];
 const result=all.filter(h=>((h.sku||'')+' '+(h.product_name||'')+' '+(h.source_label||'')).toLowerCase().includes(query)).slice(0,100);
 $('#supplierHistorySummary').textContent=all.length+' movimientos recientes registrados · mostrando '+result.length+'. Los registros anteriores permanecen en la base de datos.';
 const quantity=v=>v===null||v===undefined?'Sin dato':String(v)+' ud.';
 const currency=v=>v===null||v===undefined?'Sin dato':bs(v);
 target.innerHTML=result.map(h=>{
  const timestamp=new Date(h.recorded_at).toLocaleString('es-BO',{dateStyle:'short',timeStyle:'short'});
  return '<div class="list-item supplier-history-item"><div><strong>'+esc(h.product_name)+'</strong><small>'+esc(h.sku)+' · '+esc(timestamp)+'</small>'+
   '<small>Unidades proveedor: '+esc(quantity(h.old_supplier_stock))+' → '+esc(quantity(h.new_supplier_stock))+'</small>'+
   '<small>Precio proveedor: '+esc(currency(h.old_supplier_unit_price))+' → '+esc(currency(h.new_supplier_unit_price))+'</small>'+
   '<small>'+esc(h.source_label||'Actualización')+(h.admin_name?' · '+esc(h.admin_name):'')+'</small></div></div>';
 }).join('')||'<p class="dim">No hay movimientos que coincidan con la búsqueda.</p>';
}

function renderInventory(){
 const area=$('#inventoryFullList'),info=$('#inventorySummary');if(!area||!info)return;
 const wMap=new Map(st.wholesale.map(w=>[w.product_id,w]));
 const minor=st.products.filter(p=>!wMap.has(p.id));const majors=st.products.filter(p=>wMap.has(p.id));
 info.innerHTML=`<div class="inventory-kpi"><strong>${st.products.reduce((sum,p)=>sum+Number(p.stock||0),0)}</strong><small>Unidades en Tienda</small></div><div class="inventory-kpi"><strong>${Object.values(st.branchStocks).reduce((x,y)=>x+Number(y||0),0)}</strong><small>Unidades en La Paz</small></div><div class="inventory-kpi"><strong>${st.products.reduce((sum,p)=>sum+Number(p.stock||0)+Number(st.branchStocks[p.id]||0),0)}</strong><small>Unidades totales</small></div>`;
 area.innerHTML=st.products.map(p=>{let w=wMap.get(p.id);return `<div class="list-item inventory-line"><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${w?'Mayoristas':p.home_location==='lapaz'?'Propio de La Paz':'Tienda'} · ${esc(p.category)}</small><small>Tienda ${p.stock} ud. · La Paz ${Number(st.branchStocks[p.id]||0)} ud. · Total ${p.stock+Number(st.branchStocks[p.id]||0)} ud. · Venta individual ${bs(p.sale_price)} · Costo privado ${bs(p.purchase_cost)}</small>${p.supplier_status==='agotado'?'<small class="supplier-unavailable">Agotado en importadora · stock propio conservado</small>':''}</div><button class="mini" data-inventory-edit="${p.id}">${w?'Ir a mayoristas':p.home_location==='lapaz'?'Editar en La Paz':'Editar / fotos'}</button></div>`}).join('')||'<p>Sin productos registrados. Empieza por Tienda o Mayoristas.</p>';
}
function renderBranches(){
 const area=$('#branchProducts');if(!area)return;
 const term=($('#branchSearch').value||'').toLowerCase();
 const lp=st.products.filter(p=>(p.home_location==='lapaz'||Number(st.branchStocks[p.id]||0)>0)&&(p.name+' '+p.sku).toLowerCase().includes(term)).sort((a,b)=>a.id-b.id);
 const all=st.products.reduce((acc,p)=>acc+Number(st.branchStocks[p.id]||0),0);
 $('#branchSummary').textContent=`${lp.length} productos visibles · ${all} unidades en Sucursal La Paz (todos los productos).`;
 area.innerHTML=lp.map(p=>`<div class="list-item branch-product-item"><div class="branch-product-detail">${p.photos?.length?`<img class="branch-product-photo" loading="lazy" src="${p.photos[0].url}" alt="Foto de ${esc(p.name)}">`:'<div class="branch-product-photo branch-no-photo">Sin foto</div>'}<div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category)} · ${p.home_location==='lapaz'?'Producto exclusivo de La Paz':'Recibido por traslado'}</small><small>La Paz: ${Number(st.branchStocks[p.id]||0)} ud. · Tienda: ${p.stock} ud.</small><small>Venta ${bs(p.sale_price)} · Costo privado ${bs(p.purchase_cost)}</small></div></div><div class="branch-item-actions">${p.home_location==='lapaz'?`<button class="mini" data-lp-edit="${p.id}">Editar / fotos</button>`:`<button class="mini" data-lp-origin="${p.id}">Ver en Tienda</button>`}</div></div>`).join('')||'<p class="dim">No hay productos en La Paz. Registra el primero aquí o traslada unidades desde Tienda.</p>';
 const dir=$('#transferDirection').value;
 const options=st.products.filter(p=>p.active&&(dir==='tienda'?p.stock:Number(st.branchStocks[p.id]||0))>0).sort((a,b)=>a.id-b.id);
 const sel=$('#transferProduct'),old=sel.value;
 sel.innerHTML=options.map(p=>`<option value="${p.id}">${esc(p.sku)} · ${esc(p.name)}</option>`).join('');if(options.some(p=>String(p.id)===old))sel.value=old;
 const p=st.products.find(p=>String(p.id)===sel.value);
 $('#transferAvailable').textContent=p?`${dir==='tienda'?p.stock:Number(st.branchStocks[p.id]||0)} unidades en ${dir==='tienda'?'Tienda':'La Paz'}`:'Sin productos disponibles';
 $('#branchHistory').innerHTML=st.branchTransfers.map(t=>`<div class="list-item"><div><strong>${esc(t.sku)} · ${esc(t.name)}</strong><small>${t.source==='tienda'?'Tienda':'La Paz'} → ${t.target==='lapaz'?'La Paz':'Tienda'} · ${t.quantity} unidades</small><small>${esc(t.created_at?.slice(0,16).replace('T',' ')||'')}</small></div></div>`).join('')||'<p class="dim">Todavía no se realizaron traslados.</p>';
}
function lpPayload(){return {name:$('#lpName').value,category:$('#lpCategory').value,description:$('#lpDesc').value,sale_price:$('#lpPrice').value,purchase_cost:$('#lpCost').value,stock:Number($('#lpStock').value)}}
function clearLpForm(){const form=$('#lpProductForm');form.reset();$('#lpId').value='';$('#lpSku').value='';$('#lpStock').value='0';$('#lpFormTitle').textContent='Registrar producto exclusivo de La Paz';$('#lpPhotosExisting').innerHTML=''}
function editLpProduct(id){const p=st.products.find(x=>x.id===id);if(!p||p.home_location!=='lapaz')return toast('Este producto pertenece a Tienda. Edítalo allí.',true);navigate('branch');$('#lpId').value=p.id;$('#lpSku').value=p.sku;$('#lpName').value=p.name;$('#lpCategory').value=p.category;$('#lpDesc').value=p.description||'';$('#lpPrice').value=p.sale_price;$('#lpCost').value=p.purchase_cost;$('#lpStock').value=Number(st.branchStocks[p.id]||0);$('#lpPhotos').value='';$('#lpFormTitle').textContent='Editar '+p.sku;renderLpPhotos(p);$('#lpProductForm').scrollIntoView({behavior:'smooth',block:'start'})}
function renderLpPhotos(p){$('#lpPhotosExisting').innerHTML=p?.photos?.map(im=>`<div class="thumb"><img src="${im.url}" alt="Foto de La Paz"><button data-lp-photo-delete="${im.id}" title="Eliminar foto">×</button></div>`).join('')||'<p class="dim">Puedes añadir fotografías desde el formulario y luego guardar.</p>'}
function productPayload(){return {name:$('#productName').value,category:$('#productCategory').value,description:$('#productDescription').value,sale_price:$('#productPrice').value,purchase_cost:$('#productCost').value,stock:Number($('#productStock').value)}}
function openEditor(id){let p=st.products.find(v=>v.id===id);$('#productEditor').classList.remove('hidden');$('#editorTitle').textContent=p?'Editar producto y fotografías':'Registrar producto';$('#productId').value=p?.id||'';$('#productSku').value=p?.sku||'';$('#productSku').placeholder=p?'Código permanente':'Se asignará automáticamente: TDA-…';$('#productName').value=p?.name||'';$('#productCategory').value=p?.category||'Hogar';$('#productDescription').value=p?.description||'';$('#productPrice').value=p?.sale_price??'';$('#productCost').value=p?.purchase_cost??'';$('#productStock').value=p?.stock??'0';$('#photoManager').classList.toggle('hidden',!p);renderPhotos(p);$('#productEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function renderPhotos(p){$('#existingPhotos').innerHTML=p?.photos?.map(x=>`<div class="thumb"><img src="${x.url}" alt="Fotografía del producto"><button data-photo-delete="${x.id}" title="Eliminar imagen">×</button></div>`).join('')||'<p class="dim">Sin fotografías. Puedes añadir hasta 20.</p>'}
function whPayload(){return {name:$('#whName').value,category:$('#whCategory').value,description:$('#whDescription').value,stock:Number($('#whStock').value),units_per_pack:Number($('#whPackQty').value),units_per_carton:Number($('#whCartonQty').value),min_wholesale_qty:Number($('#whMinQty').value),colors:$('#whColors').value,supplier:$('#whSupplier').value,purchase_cost:$('#whCost').value,other_unit_cost:$('#whExtra').value,sale_price:$('#whRetail').value,wholesale_unit_price:$('#whPrice').value,pack_total_price:$('#whPackPrice').value,carton_total_price:$('#whCartonPrice').value}}
function whCalc(){let q=Number($('#whPackQty').value)||0,c=Number($('#whCartonQty').value)||0;const cost=Number($('#whCost').value||0)+Number($('#whExtra').value||0),p=Number($('#whPrice').value||0),pack=Number($('#whPackPrice').value||0),cart=Number($('#whCartonPrice').value||0);$('#whPreview').textContent=`Costo real por unidad: ${bs(cost)} · Ganancia bruta mayorista: ${bs(p-cost)} / ud. · Por embalaje (${q} ud.): ${bs(pack-q*cost)} · Por cajón (${c} ud.): ${bs(cart-c*cost)}. Valores estimados antes de otros gastos de venta.`}
function clearWholesale(){let f=$('#wholesaleForm');f.reset();$('#wholesaleId').value='';$('#wholesaleFormTitle').textContent='Registrar nuevo producto';$('#whCategory').value='Mayoristas';whCalc()}
function editWholesale(id){let w=st.wholesale.find(w=>w.id===id);if(!w)return;const ids={whName:'name',whCategory:'category',whDescription:'description',whStock:'stock',whPackQty:'units_per_pack',whCartonQty:'units_per_carton',whMinQty:'min_wholesale_qty',whColors:'colors',whSupplier:'supplier',whCost:'purchase_cost',whExtra:'other_unit_cost',whRetail:'sale_price',whPrice:'wholesale_unit_price',whPackPrice:'pack_total_price',whCartonPrice:'carton_total_price'};for(let [id,key]of Object.entries(ids))$('#'+id).value=w[key]??'';$('#wholesaleId').value=w.id;$('#wholesaleFormTitle').textContent='Editar '+w.sku;$('#whPhotos').value='';whCalc();$('#wholesaleForm').scrollIntoView({behavior:'smooth'})}
function renderWholesale(){const area=$('#wholesaleList');if(!area)return;area.innerHTML=st.wholesale.map(w=>`<div class="list-item wh-card"><div class="wh-card-main">${w.photo?`<img class="wh-img" src="/api/photos/${w.photo}" alt="Producto original">`:'<div class="wh-img wh-placeholder">Sin foto</div>'}<div><strong>${esc(w.name)}</strong><small>${esc(w.sku)} · ${w.stock} unidades disponibles</small><small>${esc(w.colors)||'Sin colores especificados'}</small><small>Embalaje ${w.units_per_pack} ud. · Cajón ${w.units_per_carton} ud.</small><small>Venta mayorista ${bs(w.wholesale_unit_price)} / ud. (desde ${w.min_wholesale_qty})</small><small class="wh-profit">Ganancia bruta por unidad: ${bs(w.wholesale_profit)} · por cajón: ${bs(w.carton_profit)}</small></div></div><div class="wh-actions"><button class="mini" data-wh-edit="${w.id}">Editar</button><a class="mini" href="/api/wholesale/${w.id}/poster?style=premium" download="${esc(w.sku)}_premium.jpg">⇩ Afiche premium</a><a class="mini" href="/api/wholesale/${w.id}/poster?style=oferta" download="${esc(w.sku)}_oferta.jpg">⇩ Afiche oferta</a><button class="mini" data-wh-photo="${w.product_id}">Añadir foto</button></div></div>`).join('')||'<p>Registra tu primer producto mayorista para crear anuncios y calcular ganancias.</p>'}
function renderSales(){
 const location=$('#saleLocation').value;
 const available=p=>location==='lapaz'?Number(st.branchStocks[p.id]||0):Number(p.stock||0);
 const options=st.products.filter(p=>p.active&&available(p)>0).sort((a,b)=>a.id-b.id);
 const select=$('#saleProduct'),old=select.value;
 select.innerHTML=options.map(p=>`<option value="${p.id}">${esc(p.name)} · ${bs(p.sale_price)} · ${available(p)} ud.</option>`).join('');
 if(options.some(p=>String(p.id)===old))select.value=old;
 $('#salesList').innerHTML=st.sales.map(s=>`<div class="list-item"><div><strong>#${s.id} ${esc(s.client)}</strong><small>${esc(s.created_at.slice(0,16).replace('T',' '))} • ${esc(s.payment_method)} • ${esc(s.status)} • ${s.location==='lapaz'?'Sucursal La Paz':'Tienda por menor'}</small><small>Ganancia est.: ${bs(s.profit)} • Por cobrar: ${bs(s.balance)}</small></div><div style="text-align:right"><strong>${bs(s.total)}</strong><div>${s.status==='Confirmada'?`${s.balance>0?`<button class="mini" data-payment-sale="${s.id}">+ Abono</button>`:''}<button class="mini danger" data-cancel-sale="${s.id}">Anular</button>`:''}</div></div></div>`).join('')||'<p>Todavía no registraste ventas.</p>';
 calculateSale();
}
function calculateSale(){const p=st.products.find(x=>x.id===Number($('#saleProduct').value));
 const q=Number($('#saleQty').value||0),location=$('#saleLocation').value;
 const transport=Number($('#saleTransport').value||0),extra=Number($('#saleExtra').value||0),expenses=Number($('#saleExpenses').value||0);
 const available=p?(location==='lapaz'?Number(st.branchStocks[p.id]||0):Number(p.stock||0)):0;
 const total=(p?.sale_price||0)*q+extra,profit=total-(p?.purchase_cost||0)*q-transport-expenses;
 $('#salePreview').textContent=`${location==='lapaz'?'Sucursal La Paz':'Tienda por menor'} · Total estimado: ${bs(total)} · Ganancia estimada: ${bs(profit)} · Stock disponible: ${available}`;
 return total;
}
function renderBranchFinance(){
 const dest=$('#branchFinance');if(!dest)return;
 const data=st.dashboard?.branches||{};
 const cards=[['tienda','Tienda por menor','▤'],['lapaz','Sucursal La Paz','⌂']];
 const make=(key,label,icon)=>{
  const d=data[key]||{};
  return `<article class="finance-card"><div class="finance-card-heading"><span class="finance-symbol">${icon}</span><div><small>RENTABILIDAD POR SUCURSAL</small><h3>${label}</h3></div></div><div class="finance-grid"><div><small>Capital en inventario</small><strong>${bs(d.investment)}</strong></div><div><small>Ganancia estimada</small><strong class="finance-profit">${bs(d.profit_total)}</strong></div><div><small>Ventas confirmadas</small><strong>${bs(d.sales_total)}</strong></div><div><small>Unidades disponibles</small><strong>${d.stock||0}</strong></div></div></article>`;
 };
 dest.innerHTML=cards.map(x=>make(...x)).join('')+`<div class="finance-footnote">El capital corresponde al costo de compra de las unidades disponibles por sucursal. La ganancia de ventas confirmadas descuenta el costo de los artículos y los gastos de transporte/venta registrados; no incluye gastos generales ni impuestos.</div>`;
 const saleSummary=$('#branchFinanceSales');if(saleSummary)saleSummary.innerHTML=dest.innerHTML;

}

const calendarState={selected:localDate(new Date()),month:new Date().getFullYear(),monthIndex:new Date().getMonth()};
function localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function safeStatus(s){return {'Pendiente':'pendiente','Confirmado':'confirmado','En camino':'en-camino','Entregado':'entregado','Cancelado':'cancelado'}[s]||'pendiente'}
function formatDateDay(iso){const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('es-BO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function setCalendarDay(iso){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return;
 calendarState.selected=iso;
 const [year,month]=iso.split('-').map(Number);
 calendarState.month=year;calendarState.monthIndex=month-1;
 $('#deliveryFilter').value=iso;
 renderDeliveries();
}
function renderDeliveries(){
 const all=st.deliveries||[],today=localDate(new Date());
 const day=calendarState.selected;
 const present=all.filter(x=>x.scheduled_at.slice(0,10)===day).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
 const dcounts={pending:all.filter(x=>!['Entregado','Cancelado'].includes(x.status)).length,today:all.filter(x=>x.scheduled_at.slice(0,10)===today&&x.status!=='Cancelado').length,done:all.filter(x=>x.status==='Entregado').length};
 $('#deliveryStats').innerHTML=`<div><span class="delivery-stat-icon">◷</span><strong>${dcounts.today}</strong><small>Entregas de hoy</small></div><div><span class="delivery-stat-icon">✦</span><strong>${dcounts.pending}</strong><small>Por completar</small></div><div><span class="delivery-stat-icon">✓</span><strong>${dcounts.done}</strong><small>Entregadas</small></div>`;
 const first=new Date(calendarState.month,calendarState.monthIndex,1);
 const last=new Date(calendarState.month,calendarState.monthIndex+1,0).getDate();
 const offset=(first.getDay()+6)%7;const cells=Math.ceil((offset+last)/7)*7;
 const title=first.toLocaleDateString('es-BO',{month:'long',year:'numeric'});
 $('#calendarMonth').textContent=title.charAt(0).toUpperCase()+title.slice(1);
 const perDay={};all.forEach(x=>{const key=x.scheduled_at.slice(0,10);(perDay[key]??=[]).push(x)});
 const buttons=[];
 for(let i=0;i<cells;i++){
  const dateObj=new Date(calendarState.month,calendarState.monthIndex,i-offset+1);
  const key=localDate(dateObj),inside=dateObj.getMonth()===calendarState.monthIndex;
  const items=perDay[key]||[],chosen=key===day;
  const dots=[...new Set(items.map(x=>safeStatus(x.status)))].slice(0,3).map(status=>`<i class="status-dot ${status}"></i>`).join('');
  buttons.push(`<button type="button" class="calendar-day${inside?'':' outside'}${chosen?' selected':''}${key===today?' is-today':''}" data-calendar-day="${key}" aria-label="${formatDateDay(key)}, ${items.length} entregas" aria-pressed="${chosen}"><span class="calendar-day-number">${dateObj.getDate()}</span><span class="calendar-day-markers">${dots}</span>${items.length?`<small>${items.length}</small>`:''}</button>`);
 }
 $('#calendarGrid').innerHTML=buttons.join('');
 $('#deliveryFilter').value=day;
 $('#calendarSelected').textContent=formatDateDay(day);
 $('#calendarDayCount').textContent=`${present.length} ${present.length===1?'entrega programada':'entregas programadas'}`;
 $('#deliveryList').innerHTML=present.map(x=>`<article class="delivery-card"><div class="delivery-card-head"><div><span class="delivery-hour">${esc(x.scheduled_at.slice(11,16))}</span><strong>${esc(x.client)}</strong></div><span class="delivery-chip ${safeStatus(x.status)}">${esc(x.status)}</span></div><div class="delivery-details">${x.product_summary?`<div>📦 <span>${esc(x.product_summary)}</span></div>`:''}<div>📍 <span>${esc(x.location)}</span></div>${x.phone?`<div>☎ <span>${esc(x.phone)}</span></div>`:''}${x.notes?`<div>✎ <span>${esc(x.notes)}</span></div>`:''}</div><div class="delivery-actions"><label>Estado<select class="delivery-select" data-delivery="${x.id}">${['Pendiente','Confirmado','En camino','Entregado','Cancelado'].map(s=>`<option value="${s}" ${s===x.status?'selected':''}>${s}</option>`).join('')}</select></label><button class="mini" data-edit-delivery="${x.id}">✎ Editar entrega</button></div></article>`).join('')||'<div class="delivery-empty"><span>▦</span><strong>Sin entregas este día</strong><p>Selecciona otra fecha o programa una nueva entrega.</p></div>';
}
function resetDeliveryEditor(){
 $('#deliveryForm').reset();$('#deliveryEditId').value='';$('#deliveryEditorTitle').textContent='Programar nueva entrega';$('#deliverySaveBtn').textContent='+ Guardar entrega';$('#deliveryCancelEdit').classList.add('hidden');
}
function openDeliveryEditor(id){
 if(!id){resetDeliveryEditor();$('#deliveryDate').value='';}
 else{
  const d=st.deliveries.find(x=>x.id===id);if(!d)return;
  $('#deliveryEditId').value=d.id;$('#deliveryClient').value=d.client;$('#deliveryPhone').value=d.phone||'';$('#deliveryProduct').value=d.product_summary||'';$('#deliveryDate').value=d.scheduled_at.slice(0,16);$('#deliveryLocation').value=d.location;$('#deliveryNotes').value=d.notes||'';
  $('#deliveryEditorTitle').textContent='Editar entrega de '+d.client;$('#deliverySaveBtn').textContent='✓ Guardar cambios';$('#deliveryCancelEdit').classList.remove('hidden');
 }
 $('#deliveryEditor').scrollIntoView({behavior:'smooth',block:'start'});
}
function jobRow(j,action=true){let p=st.products.find(x=>x.id===j.product_id);let status={queued:'En espera',running:'Procesando',done:'Completado',failed:'Error'}[j.status]||j.status;let badge=j.status==='done'?'':j.status==='failed'?'fail':'warn';let per=Math.round(j.completed/j.target*100);return `<div class="list-item" style="display:block"><div style="display:flex;justify-content:space-between"><strong>Lote #${j.id} • ${esc(p?.name||'Producto')} </strong><span class="pill ${badge}">${status}</span></div><small>${j.mode==='ia'?'IA (API pagada)':'Plantillas locales'} · ${j.completed}/${j.target}</small><div class="progress"><div style="width:${per}%"></div></div>${j.error?`<small class="danger">${esc(j.error)}</small>`:''}${action?`<button class="mini" data-gallery="${j.id}">Ver imágenes</button>`:''}</div>`}
function renderJobs(){$('#jobList').innerHTML=st.jobs.map(j=>jobRow(j)).join('')||'<p>Genera tus primeras imágenes.</p>';if(st.selectedJob)loadGallery(st.selectedJob,true)}
function renderOptions(){const productopts=st.products.filter(p=>p.active).map(p=>`<option value="${p.id}">${esc(p.name)} · ${bs(p.sale_price)}</option>`).join('');for(const selector of ['#jobProduct','#adProduct']){let s=$(selector);let old=s.value;if(s.dataset.cache!==productopts){s.innerHTML=productopts;s.dataset.cache=productopts;s.value=old||s.options[0]?.value||''}}}
function renderNotifications(){$('#bellCount').textContent=st.notices.length||'';$('#notices').innerHTML=st.notices.map(n=>`<div class="list-item"><div><strong>${esc(n.message)}</strong><small>${esc(n.created_at.slice(0,16).replace('T',' '))}</small></div></div>`).join('')||'<p>Aún no tienes notificaciones.</p>'}
function renderAudit(){$('#auditList').innerHTML=st.audit.map(a=>`<div class="list-item"><div><strong>${esc(a.admin)} · ${esc(a.action)}</strong><small>${esc(a.detail)} · ${esc(a.created_at.slice(0,16).replace('T',' '))}</small></div></div>`).join('')||'<p>Abre esta sección para consultar la actividad.</p>'}
async function loadGallery(id,silent=false){
 st.selectedJob=id;
 const imgs=await api(`/jobs/${id}/images`);st.galleryImages=imgs;
 const job=st.jobs.find(x=>x.id===id);
 const deletable=job&&['done','failed'].includes(job.status);
 $('#galleryActions').innerHTML=`<div class="gallery-toolbar">
 <button class="btn primary" data-save-all ${imgs.length?'':'disabled'}>⇩ Guardar todas · JPG separados (${imgs.length})</button>
 <button class="btn secondary" data-save-approved ${imgs.some(x=>x.approved)?'':'disabled'}>✓ Guardar aprobadas</button>
 <button class="btn secondary danger-action" data-delete-lot ${deletable?'':'disabled'}>🗑 Borrar lote del servidor</button></div>
 <p class="dim gallery-help">Las imágenes se guardan individualmente, sin ZIP. Algunos navegadores solicitan permiso para descargar varios archivos. Revisa la galería o Descargas de tu teléfono antes de borrar el lote. Eliminar aquí no borra fotografías ya guardadas en tu celular ni las fotos originales del producto.</p>`;
 $('#gallery').innerHTML=imgs.map((im,i)=>`<div class="gallery-item"><img src="${im.url}" loading="lazy" alt="Anuncio generado ${i+1}"><div class="gallery-item-actions"><a class="mini" href="/api/generated/${im.id}/download" download="MegaCompra_${id}_${i+1}.jpg">⇩ JPG</a><label><input type="checkbox" data-approve="${im.id}" ${im.approved?'checked':''}> Aprobar</label></div></div>`).join('')||'<p>Este lote ya no tiene imágenes guardadas.</p>';
 if(!silent)$('#gallery').scrollIntoView({behavior:'smooth'});
}
function galleryFileName(jobId,imageId){return `MegaCompra_${jobId}_${imageId}.jpg`}
async function downloadGalleryFiles(approvedOnly=false){
 const imgs=st.galleryImages.filter(im=>!approvedOnly||im.approved);
 if(!imgs.length)return toast('No hay imágenes seleccionadas para guardar.',true);
 const btn=$('[data-save-all]');const btn2=$('[data-save-approved]');
 if(btn)btn.disabled=true;if(btn2)btn2.disabled=true;
 try{
   // En navegadores de escritorio compatibles, escribe los JPG en la carpeta elegida.
   if(typeof window.showDirectoryPicker==='function'){
     const dir=await window.showDirectoryPicker({mode:'readwrite'});
     for(let i=0;i<imgs.length;i++){
       const im=imgs[i];const r=await fetch(`/api/generated/${im.id}/download`,{credentials:'same-origin'});
       if(!r.ok)throw Error(`No se pudo obtener la imagen ${i+1}`);
       const handle=await dir.getFileHandle(galleryFileName(st.selectedJob,im.id),{create:true});
       const writable=await handle.createWritable();try{await writable.write(await r.blob())}finally{await writable.close()}
     }
     toast(`Guardadas ${imgs.length} imágenes JPG en la carpeta seleccionada.`);return;
   }
   // Alternativa móvil: la hoja Compartir puede guardar múltiples JPG como en un álbum.
   // En algunos navegadores se pierde la activación del gesto al preparar los archivos.
   if(navigator.share&&navigator.canShare&&typeof File!=='undefined'){
     try{
       const files=[];
       for(const im of imgs){
         const r=await fetch(`/api/generated/${im.id}/download`,{credentials:'same-origin'});
         if(!r.ok)throw Error('No se pudieron cargar todas las imágenes.');
         files.push(new File([await r.blob()],galleryFileName(st.selectedJob,im.id),{type:'image/jpeg'}));
       }
       if(navigator.canShare({files})){
         await navigator.share({files,title:`MegaCompra - lote ${st.selectedJob}`});
         toast('Se enviaron las imágenes a la opción elegida. Comprueba que se hayan guardado.');return;
       }
     }catch(err){if(err.name==='AbortError')return;console.info('Compartir archivos no disponible:',err)}
   }
   // Alternativa universal: descargas individuales, no un ZIP. El navegador puede bloquear varias.
   for(let i=0;i<imgs.length;i++){
     const a=document.createElement('a');a.href=`/api/generated/${imgs[i].id}/download`;
     a.download=galleryFileName(st.selectedJob,imgs[i].id);a.style.display='none';
     document.body.appendChild(a);a.click();a.remove();
     await new Promise(resolve=>setTimeout(resolve,350));
   }
   toast(`Se solicitaron ${imgs.length} descargas JPG. Si tu navegador las bloquea, autoriza descargas múltiples o usa los botones JPG individuales.`);
 }catch(err){
   if(err.name!=='AbortError')toast(err.message||'No se completó la descarga. Usa los botones JPG individuales.',true);
 }finally{if(btn)btn.disabled=false;if(btn2)btn2.disabled=false}
}
async function removeGalleryJob(){
 const id=st.selectedJob;
 if(!id)return;
 const answer=prompt('Esto borrará definitivamente del servidor TODOS los anuncios generados de este lote. No elimina los originales ni los archivos guardados en tu celular. Antes de continuar, comprueba tus descargas. Escribe BORRAR para confirmar:');
 if(answer!=='BORRAR')return;
 try{
   const result=await api(`/jobs/${id}`,{method:'DELETE'});
   st.selectedJob=null;st.galleryImages=[];
   $('#galleryActions').innerHTML='';$('#gallery').innerHTML='<p>El lote se borró del servidor. Las fotos del producto se conservaron.</p>';
   await refresh();toast(`Se eliminaron ${result.deleted} anuncios del servidor.`);
 }catch(err){toast(err.message,true)}
}
async function loadAds(){let id=$('#adProduct').value;if(!id)return toast('Registra un producto primero',true);let d=await api(`/products/${id}/draft`);$('#fbTitle').value=d.facebook_title;$('#fbDescription').value=d.facebook_description;$('#tkCaption').value=d.tiktok_caption;toast('Borradores listos para copiar')}
function realtime(){try{let ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');st.ws=ws;ws.onopen=()=>{$('#conn').textContent='● En tiempo real'};ws.onmessage=()=>refresh();ws.onclose=()=>{$('#conn').textContent='● Reconectando';if(st.me)setTimeout(realtime,5000)}}catch(e){console.log(e)}}
function on(sel,event,handler){$(sel).addEventListener(event,handler)}
on('#loginForm','submit',async e=>{e.preventDefault();$('#loginError').textContent='';let f=new FormData(e.currentTarget);try{st.me=await api('/login',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});showApp();await refresh();realtime()}catch(ex){$('#loginError').textContent=ex.message}});
on('#logout','click',async()=>{try{await api('/logout',{method:'POST'})}catch{}st.me=null;st.ws?.close();showLogin()});
$$('.nav').forEach(b=>b.addEventListener('click',async()=>{navigate(b.dataset.page);if(b.dataset.page==='activity'){st.audit=await api('/audit');renderAudit()}}));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
on('#menuToggle','click',()=>$('.sidebar').classList.toggle('open'));
on('#wholesaleNew','click',()=>{clearWholesale();$('#wholesaleForm').scrollIntoView({behavior:'smooth'})});
for(const n of ['#whPackQty','#whCartonQty','#whPrice','#whPackPrice','#whCartonPrice','#whCost','#whExtra'])on(n,'input',whCalc);
on('#wholesaleForm','submit',async e=>{e.preventDefault();let id=$('#wholesaleId').value,uploads=[...$('#whPhotos').files];try{let row=await api(id?`/wholesale/${id}`:'/wholesale',{method:id?'PUT':'POST',body:JSON.stringify(whPayload())});if(uploads.length){let data=new FormData();for(let f of uploads)data.append('photos',f);try{await api(`/products/${row.product_id}/photos`,{method:'POST',body:data})}catch(err){toast('Producto guardado, pero la foto falló: '+err.message,true)}}st.wholesale=await api('/wholesale');await refresh();clearWholesale();toast('Producto por mayor guardado con código '+row.sku)}catch(err){toast(err.message,true)}});
on('#wholesaleList','click',async e=>{let ed=e.target.closest('[data-wh-edit]'),photo=e.target.closest('[data-wh-photo]');if(ed)editWholesale(Number(ed.dataset.whEdit));if(photo){navigate('products');openEditor(Number(photo.dataset.whPhoto))}});
on('#inventoryFullList','click',e=>{const b=e.target.closest('[data-inventory-edit]');if(!b)return;let id=Number(b.dataset.inventoryEdit),w=st.wholesale.find(w=>w.product_id===id);if(w){navigate('wholesale');editWholesale(w.id)}else if(st.products.find(p=>p.id===id)?.home_location==='lapaz'){editLpProduct(id)}else{navigate('products');openEditor(id)}});
on('#newProduct','click',()=>openEditor());on('#closeEditor','click',()=>$('#productEditor').classList.add('hidden'));
on('#searchProducts','input',renderProducts);


on('#catalogFind','input',renderCatalogList);
on('#catalogVisibility','change',renderCatalogList);
on('#catalogReload','click',loadCatalogAdmin);
on('#catalogCopyLink','click',async()=>{
 const link=location.origin+'/catalogo';
 try{await navigator.clipboard.writeText(link);toast('Enlace del catálogo público copiado')}catch{
  window.prompt('Copia el enlace de tu catálogo:',link);
 }
});
on('#catalogProductList','click',ev=>{
 const button=ev.target.closest('[data-catalog-edit]');if(!button)return;
 const row=st.catalogAdmin.find(x=>x.product_id===Number(button.dataset.catalogEdit));
 if(row)fillCatalogEditor(row);
});
on('#catalogUseExisting','click',()=>{
 const row=st.catalogAdmin.find(x=>x.product_id===st.catalogEditingId);
 if(!row){toast('Selecciona un producto primero',true);return}
 if(Number(row.sale_price_existing)<=0){toast('Ese producto todavía no tiene precio de venta registrado',true);return}
 $('#catalogPriceUnit').value=Number(row.sale_price_existing).toFixed(2);
 toast('Precio actual copiado solo al editor público. Guarda para confirmar.');
});
on('#catalogForm','submit',async ev=>{
 ev.preventDefault();
 const id=Number($('#catalogProductId').value);
 if(!id){toast('Selecciona primero un producto de la lista',true);return}
 const payload=catalogFormData();
 if(payload.published&&!payload.price_unit){toast('Indica el precio por unidad antes de publicar',true);return}
 if((payload.price_case===null)!==(payload.case_units===null)){
  toast('Para precio por cajón, indica la cantidad de piezas y el precio total',true);return;
 }
 const button=$('#catalogSave');
 button.disabled=true;
 try{
  const updated=await api('/catalogo/admin/'+id,{method:'PUT',body:JSON.stringify(payload)});
  const index=st.catalogAdmin.findIndex(x=>x.product_id===id);
  if(index>=0)st.catalogAdmin[index]=updated;
  fillCatalogEditor(updated);
  toast(updated.published?'Producto publicado en el catálogo para clientes':'Configuración guardada; producto no publicado');
 }catch(err){toast(err.message,true)}
 finally{button.disabled=false}
});

on('#supplierSearch','input',renderSupplier);
on('#supplierFilter','change',renderSupplier);
on('#supplierHistorySearch','input',renderSupplierHistory);

['#supplierAlertStatusFilter','#supplierAlertTypeFilter'].forEach(sel=>on(sel,'change',renderSupplierAlerts));
on('#supplierAlertSearch','input',renderSupplierAlerts);
on('#supplierAlertRefresh','click',async()=>{await refresh();toast('Alertas consultadas desde MegaBot')});
on('#supplierAlertsList','click',async e=>{
 const btn=e.target.closest('button');if(!btn)return;
 const rawId=btn.dataset.supplierAlertReview||btn.dataset.supplierAlertCopy||btn.dataset.supplierAlertCatalog;
 const a=st.supplierAlerts.find(x=>x.id===Number(rawId));if(!a)return;
 if(btn.dataset.supplierAlertCatalog){
  navigate('supplier');$('#supplierSearch').value=a.sku;renderSupplier();return;
 }
 if(btn.dataset.supplierAlertCopy){
  const type=SUPPLIER_ALERT_TYPES[a.kind]||{name:'Cambio en importadora',action:'Revisar publicación en Facebook'};
  const message=[
   'MEGACOMPRA · Revisar publicación de Facebook',
   a.product_name+' ('+a.sku+')',
   type.name,
   'Cantidad antes: '+(a.old_supplier_stock==null?'sin dato':a.old_supplier_stock),
   'Cantidad ahora: '+(a.new_supplier_stock==null?'sin dato':a.new_supplier_stock),
   'Precio proveedor antes: '+(a.old_supplier_unit_price==null?'sin dato':bs(a.old_supplier_unit_price)),
   'Precio proveedor ahora: '+(a.new_supplier_unit_price==null?'sin dato':bs(a.new_supplier_unit_price)),
   type.action
  ].join(String.fromCharCode(10));
  try{
   if(!navigator.clipboard?.writeText)throw Error('Copiar no disponible');
   await navigator.clipboard.writeText(message);
   toast('Recordatorio copiado para gestionar tu publicación');
  }catch{toast('No se pudo copiar. Puedes revisar los datos de la tarjeta.',true)}
  return;
 }
 if(btn.dataset.supplierAlertReview){
  if(btn.disabled)return;btn.disabled=true;
  try{
   const reviewed=!a.reviewed_at;
   const result=await api('/supplier/alerts/'+a.id+'/review',{method:'POST',body:JSON.stringify({reviewed})});
   a.reviewed_at=result.reviewed_at;
   st.supplierAlertCount=Math.max(0,Number(st.supplierAlertCount||0)+(reviewed?-1:1));
   renderSupplierAlerts();
   toast(reviewed?'Alerta marcada como revisada':'Alerta restaurada a pendientes');
  }catch(err){toast(err.message,true);btn.disabled=false}
 }
});

on('#supplierCancel','click',()=>$('#supplierEditor').classList.add('hidden'));
on('#supplierList','click',e=>{
 const btn=e.target.closest('[data-supplier-edit]');if(!btn)return;
 const p=st.products.find(x=>x.id===Number(btn.dataset.supplierEdit));if(!p)return;
 $('#supplierProductId').value=String(p.id);
 $('#supplierEditorTitle').textContent='Importadora · '+p.sku+' · '+p.name;
 $('#supplierQty').value=p.supplier_stock==null?'':String(p.supplier_stock);
 $('#supplierUnitPrice').value=p.supplier_unit_price==null?'':String(p.supplier_unit_price);
 $('#supplierStatus').value=p.supplier_status||'sin_revisar';
 $('#supplierEditor').classList.remove('hidden');
 $('#supplierEditor').scrollIntoView({behavior:'smooth',block:'start'});
});
on('#supplierForm','submit',async e=>{
 e.preventDefault();const save=$('#supplierSave');if(save.disabled)return;save.disabled=true;
 try{
  const id=Number($('#supplierProductId').value);
  const qty=$('#supplierQty').value.trim(),price=$('#supplierUnitPrice').value.trim();
  const payload={supplier_stock:qty===''?null:Number(qty),
    supplier_unit_price:price===''?null:Number(price),status:$('#supplierStatus').value};
  const updated=await api('/products/'+id+'/supplier-catalog',{method:'PUT',body:JSON.stringify(payload)});
  st.products=st.products.map(x=>x.id===id?updated:x);
  $('#supplierEditor').classList.add('hidden');
  renderSupplier();renderProducts();
  toast('Proveedor actualizado. El inventario propio y tus ganancias no cambiaron.');
  await refresh();
 }catch(err){toast(err.message,true)}finally{save.disabled=false}
});

on('#lpNew','click',()=>{clearLpForm();$('#lpName').focus()});
on('#lpProductForm','submit',async e=>{e.preventDefault();const btn=$('#lpSaveBtn');if(btn.disabled)return;btn.disabled=true;let created=null;try{
 const id=$('#lpId').value;
 created=await api(id?`/branches/lapaz/products/${id}`:'/branches/lapaz/products',{method:id?'PUT':'POST',body:JSON.stringify(lpPayload())});
 st.products=st.products.filter(x=>x.id!==created.id);st.products.unshift(created);
 st.branchStocks[created.id]=created.lapaz_stock;
 const files=[...$('#lpPhotos').files];let photoError='';
 if(files.length){let f=new FormData();for(const photo of files)f.append('photos',photo);
  try{await api(`/products/${created.id}/photos`,{method:'POST',body:f})}catch(e){photoError=e.message}}
 clearLpForm();await refresh();editLpProduct(created.id);
 toast(photoError?`Producto ${created.sku} guardado. Fotos pendientes: ${photoError}`:`Producto ${created.sku} y sus datos guardados en La Paz`,Boolean(photoError));
 }catch(err){toast(err.message,true)}finally{btn.disabled=false}
});
on('#branchProducts','click',e=>{const edit=e.target.closest('[data-lp-edit]'),origin=e.target.closest('[data-lp-origin]');if(edit)editLpProduct(Number(edit.dataset.lpEdit));if(origin){navigate('products');openEditor(Number(origin.dataset.lpOrigin))}});
on('#lpPhotosExisting','click',async e=>{const btn=e.target.closest('[data-lp-photo-delete]');if(!btn||!confirm('¿Eliminar esta fotografía original?'))return;try{await api(`/photos/${btn.dataset.lpPhotoDelete}`,{method:'DELETE'});const pid=Number($('#lpId').value);await refresh();editLpProduct(pid);toast('Fotografía eliminada')}catch(err){toast(err.message,true)}});
on('#branchSearch','input',renderBranches);
on('#transferDirection','change',renderBranches);
on('#transferProduct','change',renderBranches);
on('#saleLocation','change',renderSales);
on('#branchTransferForm','submit',async e=>{
 e.preventDefault();const btn=e.currentTarget.querySelector('button');if(btn.disabled)return;
 const p=Number($('#transferProduct').value),q=Number($('#transferQuantity').value),source=$('#transferDirection').value;
 if(!p||!Number.isInteger(q)||q<=0)return toast('Selecciona producto y cantidad válida',true);
 if(!confirm(`¿Trasladar ${q} unidades de ${source==='tienda'?'Tienda':'La Paz'} a ${source==='tienda'?'La Paz':'Tienda'}?`))return;
 btn.disabled=true;
 try{const result=await api('/branches/lapaz/transfer',{method:'POST',body:JSON.stringify({product_id:p,quantity:q,source_location:source})});
  toast(`Traslado confirmado: ${result.sku}. Tienda ${result.tienda_stock} ud., La Paz ${result.lapaz_stock} ud.`);
  await refresh();
 }catch(err){toast(err.message,true)}finally{btn.disabled=false}
});
on('#productForm','submit',async e=>{
 e.preventDefault();const button=e.currentTarget.querySelector('button');if(button?.disabled)return;if(button)button.disabled=true;
 try{const id=$('#productId').value;const created=await api(id?`/products/${id}`:'/products',{method:id?'PUT':'POST',body:JSON.stringify(productPayload())});
 st.products=st.products.filter(p=>p.id!==created.id);st.products.unshift(created);openEditor(created.id);render();toast('Producto '+created.sku+' guardado. Ahora puedes subir sus fotos.');await refresh()
 }catch(ex){toast(ex.message,true)}finally{if(button)button.disabled=false}
});
on('#photoInput','change',()=>$('#photoNames').textContent=[...$('#photoInput').files].map(f=>f.name).join(' · '));
on('#photoForm','submit',async e=>{e.preventDefault();let id=$('#productId').value;let files=$('#photoInput').files;if(!id||!files.length)return toast('Selecciona imágenes',true);let f=new FormData();for(let file of files)f.append('photos',file);try{await api(`/products/${id}/photos`,{method:'POST',body:f});$('#photoInput').value='';await refresh();openEditor(Number(id));toast('Fotografías guardadas')}catch(ex){toast(ex.message,true)}});
on('#productCards','click',async e=>{let b=e.target.closest('button');if(!b)return;let {edit,ad,gen,archive,supplierToggle}=b.dataset;try{if(supplierToggle){const p=st.products.find(x=>x.id===Number(supplierToggle));if(p){const status=p.supplier_status==='agotado'?'disponible':'agotado';await api(`/products/${p.id}/supplier-status`,{method:'POST',body:JSON.stringify({status})});p.supplier_status=status;toast(status==='agotado'?'Marcado agotado en importadora. Stock propio intacto.':'Proveedor marcado disponible.');await refresh()}return}if(edit)openEditor(Number(edit));if(ad){navigate('ads');$('#adProduct').value=ad;await loadAds()}if(gen){navigate('studio');$('#jobProduct').value=gen}if(archive&&confirm('¿Archivar el producto? Se conservará en el historial.')){await api(`/products/${archive}/archive`,{method:'POST'});await refresh()}}catch(ex){toast(ex.message,true)}});
on('#existingPhotos','click',async e=>{let b=e.target.closest('[data-photo-delete]');if(!b||!confirm('¿Eliminar la fotografía?'))return;try{await api(`/photos/${b.dataset.photoDelete}`,{method:'DELETE'});await refresh();openEditor(Number($('#productId').value))}catch(ex){toast(ex.message,true)}});
['#saleProduct','#saleQty','#saleTransport','#saleExpenses','#saleExtra'].forEach(s=>on(s,'input',calculateSale));
on('#saleForm','submit',async e=>{e.preventDefault();try{let total=calculateSale();let data={client:$('#saleClient').value,phone:$('#salePhone').value,payment_method:$('#salePayment').value,paid_amount:$('#salePaid').value||0,transport_cost:$('#saleTransport').value||0,other_expenses:$('#saleExpenses').value||0,extra_income:$('#saleExtra').value||0,items:[{product_id:Number($('#saleProduct').value),quantity:Number($('#saleQty').value)}],location:$('#saleLocation').value};if(Number(data.paid_amount)>total)return toast('El pago supera el total',true);if(!confirm(`¿Confirmar venta de ${bs(total)}? Se descontará el inventario.`))return;await api('/sales',{method:'POST',body:JSON.stringify(data)});await refresh();toast('Venta registrada e inventario actualizado')}catch(ex){toast(ex.message,true)}});
on('#salesList','click',async e=>{let pay=e.target.closest('[data-payment-sale]');if(pay){
 let sale=st.sales.find(s=>s.id===Number(pay.dataset.paymentSale));
 let amount=prompt(`Venta #${sale.id}. Saldo: ${bs(sale.balance)}. ¿Cuánto abonó el cliente?`);
 if(amount===null)return;let method=prompt('Método de pago: Efectivo, QR o Transferencia','QR');if(method===null)return;
 if(!['Efectivo','QR','Transferencia'].includes(method))return toast('Método de pago inválido',true);
 try{await api(`/sales/${sale.id}/payments`,{method:'POST',body:JSON.stringify({amount:Number(amount),method})});await refresh();toast('Abono registrado')}catch(ex){toast(ex.message,true)}return;
 }let b=e.target.closest('[data-cancel-sale]');if(!b||!confirm('¿Anular venta y devolver stock? Registra el reembolso al cliente por separado.'))return;try{await api(`/sales/${b.dataset.cancelSale}/cancel`,{method:'POST'});await refresh()}catch(ex){toast(ex.message,true)}});
on('#passwordForm','submit',async e=>{e.preventDefault();try{await api('/change-password',{method:'POST',body:JSON.stringify({old_password:$('#oldPassword').value,new_password:$('#newPassword').value})});st.me=null;st.ws?.close();showLogin();toast('Contraseña actualizada. Inicia sesión nuevamente.')}catch(ex){toast(ex.message,true)}});
on('#calendarPrev','click',()=>{const d=new Date(calendarState.month,calendarState.monthIndex-1,1);calendarState.month=d.getFullYear();calendarState.monthIndex=d.getMonth();renderDeliveries()});
on('#calendarNext','click',()=>{const d=new Date(calendarState.month,calendarState.monthIndex+1,1);calendarState.month=d.getFullYear();calendarState.monthIndex=d.getMonth();renderDeliveries()});
on('#calendarToday','click',()=>setCalendarDay(localDate(new Date())));
on('#calendarGrid','click',e=>{const b=e.target.closest('[data-calendar-day]');if(b)setCalendarDay(b.dataset.calendarDay)});
on('#deliveryFilter','change',e=>{if(e.target.value)setCalendarDay(e.target.value)});
on('#calendarNew','click',()=>openDeliveryEditor());
on('#deliveryCancelEdit','click',resetDeliveryEditor);
on('#deliveryForm','submit',async e=>{
 e.preventDefault();let id=$('#deliveryEditId').value;
 const obj={client:$('#deliveryClient').value,phone:$('#deliveryPhone').value,product_summary:$('#deliveryProduct').value,location:$('#deliveryLocation').value,scheduled_at:$('#deliveryDate').value,notes:$('#deliveryNotes').value};
 const button=$('#deliverySaveBtn');if(button.disabled)return;button.disabled=true;
 try{
  await api(id?`/deliveries/${id}`:'/deliveries',{method:id?'PUT':'POST',body:JSON.stringify(obj)});
  setCalendarDay(obj.scheduled_at.slice(0,10));resetDeliveryEditor();
  await refresh();toast(id?'Entrega actualizada':'Entrega registrada en el calendario');
 }catch(ex){toast(ex.message,true)}finally{button.disabled=false}
});
on('#deliveryList','click',e=>{const b=e.target.closest('[data-edit-delivery]');if(b)openDeliveryEditor(Number(b.dataset.editDelivery))});
on('#deliveryList','change',async e=>{const el=e.target.closest('[data-delivery]');if(!el)return;try{await api(`/deliveries/${el.dataset.delivery}/status`,{method:'PATCH',body:JSON.stringify({status:el.value})});await refresh();toast('Estado de entrega actualizado')}catch(ex){toast(ex.message,true)}});
on('#jobForm','submit',async e=>{e.preventDefault();let mode=$('#jobMode').value,count=Number($('#jobCount').value);if(mode==='ia'&&!confirm(`Este proceso solicita ${count} imágenes a una API pagada. ¿Confirmas que aceptas los cargos según tu proveedor?`))return;try{let j=await api('/jobs',{method:'POST',body:JSON.stringify({product_id:Number($('#jobProduct').value),mode,count})});await refresh();toast(`Lote #${j.id} creado. Podrás ver el progreso en tiempo real.`)}catch(ex){toast(ex.message,true)}});
on('#jobList','click',e=>{let b=e.target.closest('[data-gallery]');if(b)loadGallery(Number(b.dataset.gallery))});
on('#galleryActions','click',e=>{let button=e.target.closest('button');if(!button)return;if(button.hasAttribute('data-save-all'))downloadGalleryFiles(false);else if(button.hasAttribute('data-save-approved'))downloadGalleryFiles(true);else if(button.hasAttribute('data-delete-lot'))removeGalleryJob()});
on('#gallery','change',async e=>{let b=e.target.closest('[data-approve]');if(!b)return;try{await api(`/generated/${b.dataset.approve}`,{method:'PATCH',body:JSON.stringify({approved:b.checked})});toast('Aprobación registrada')}catch(ex){toast(ex.message,true)}});
on('#loadAd','click',loadAds);
on('#loadAiAd','click',async()=>{let id=$('#adProduct').value;if(!id)return toast('Selecciona un producto',true);if(!confirm('Esta opción utiliza una API de IA que puede generar cargos. ¿Deseas continuar?'))return;try{let d=await api(`/products/${id}/draft-ai`,{method:'POST'});$('#fbTitle').value=d.facebook_title;$('#fbDescription').value=d.facebook_description;$('#tkCaption').value=d.tiktok_caption;toast('Textos redactados con IA listos')}catch(ex){toast(ex.message,true)}});
on('#copyFacebook','click',async()=>{await navigator.clipboard.writeText($('#fbTitle').value+'\n\n'+$('#fbDescription').value);toast('Texto de Facebook copiado')});
on('#copyTikTok','click',async()=>{await navigator.clipboard.writeText($('#tkCaption').value);toast('Texto de TikTok copiado')});

on('#supplierWatchSearch','input',renderSupplierWatch);
on('#supplierWatchFilter','change',renderSupplierWatch);
on('#supplierWatchRefresh','click',async()=>{
 try{st.supplierWatch=await api('/supplier/watch');renderSupplierWatch();toast('Novedades cargadas. La revisión externa automática sigue pendiente de conexión.')}
 catch(error){toast(error.message,true)}
});
on('#supplierWatchAlerts','click',async event=>{
 const button=event.target.closest('[data-supplier-watch-review]');if(!button)return;
 const id=Number(button.dataset.supplierWatchReview);if(!Number.isSafeInteger(id))return;
 button.disabled=true;
 try{await api('/supplier/watch/alerts/'+id+'/review',{method:'POST',body:JSON.stringify({reviewed:true})});
 st.supplierWatch=await api('/supplier/watch');renderSupplierWatch();toast('Novedad marcada como revisada')}
 catch(error){toast(error.message,true);button.disabled=false}
});
on('#notificationBtn','click',async()=>{$('#noticePanel').classList.toggle('hidden');if('Notification'in window&&Notification.permission==='default')try{await Notification.requestPermission()}catch{}});on('#closeNotices','click',()=>$('#noticePanel').classList.add('hidden'));
on('#enablePush','click',async()=>{try{
  if(!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('Este navegador no admite notificaciones push.');
  let config=await api('/push/config');
  if(!config.enabled)throw Error('Falta configurar VAPID y HTTPS en el servidor. Los avisos seguirán visibles dentro de MegaBot.');
  let permission=await Notification.requestPermission();if(permission!=='granted')throw Error('No autorizaste las notificaciones en este dispositivo.');
  let registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
  const key=Uint8Array.from(atob(config.public_key.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(config.public_key.length/4)*4,'=')),c=>c.charCodeAt(0));
  let sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await api('/push/subscribe',{method:'POST',body:JSON.stringify(sub.toJSON())});toast('Notificaciones push activadas en este dispositivo');
 }catch(ex){toast(ex.message,true)}});
// Una paleta de 50 colores distinta por formato; la composición se controla en el servidor.
const colors=['#00D5FF','#9A5BFF','#00E5A8','#FF4D8D','#376BFF','#FF7A00','#BBF742','#20B8DB','#C370F6','#F43F5E','#14B8A6','#FACC15','#8884FF','#FF6D98','#38BDF8','#FFFFFF','#FAFAFA','#F1F4F7','#FFF7EF','#F1F8FF','#EEFFF6','#FFF3FA','#F7F2FF','#FFFAEE','#F2F6FA','#F0E3D2','#E8EFE4','#F8E1D2','#DCEBF8','#F9EDDA','#E4F0D8','#FEF6E8','#DDCEBD','#F1F6FB','#F3EFFB','#FF4C63','#FFB625','#47D88D','#57A6FF','#BB70FF','#FF75C1','#6FEAFA','#FF985C','#BEF05F','#FFE169','#D5AF52','#FC3582','#4EA4FF','#AC81FF','#E5E5E5'];
$('#palettePreview').innerHTML=colors.map((c,i)=>`<div title="Diseño ${i+1}" style="background:${c}"></div>`).join('');
// El estilo se guarda únicamente en este dispositivo.
const permittedThemes=['royal','violet','ocean','emerald'];
function setTheme(theme){if(!permittedThemes.includes(theme))theme='royal';document.documentElement.dataset.theme=theme;localStorage.setItem('megabot_theme',theme);const sel=$('#themeSelect');if(sel)sel.value=theme}
setTheme(localStorage.getItem('megabot_theme')||'royal');
on('#themeSelect','change',e=>setTheme(e.target.value));
on('#setupForm','submit',async e=>{e.preventDefault();$('#setupError').textContent='';try{
 const res=await fetch('/api/setup/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({setup_token:$('#setupToken').value,username:$('#setupUsername').value,display_name:$('#setupDisplay').value,password:$('#setupPassword').value})});
 const data=await res.json();if(!res.ok)throw Error(data.detail||'Error configurando el acceso');
 $('#setupToken').value='';$('#setupPassword').value='';showLogin();toast('Cuenta creada. Ingresa con tu usuario y contraseña.');
}catch(ex){$('#setupError').textContent=ex.message}});
async function refreshTeam(){try{const a=await api('/admins');$('#teamAdmins').innerHTML=a.map(x=>`<div class="list-item"><strong>${esc(x.display_name)}</strong><small>${esc(x.username)} · ${x.active?'Activo':'Inactivo'}</small></div>`).join('');$('#teamAdminForm').classList.toggle('hidden',a.length>=3)}catch(ex){console.warn(ex)}}
on('#teamAdminForm','submit',async e=>{e.preventDefault();try{await api('/admins',{method:'POST',body:JSON.stringify({username:$('#teamUsername').value,display_name:$('#teamDisplay').value,password:$('#teamPassword').value})});$('#teamAdminForm').reset();await refreshTeam();toast('Administrador agregado')}catch(ex){toast(ex.message,true)}});
(async()=>{try{st.me=await api('/me');showApp();await refresh();await refreshTeam();realtime()}catch{showLogin();try{const setup=await api('/setup/status');if(setup.needs_setup&&setup.setup_available)showSetup()}catch{}}})();
setInterval(()=>{if(st.me)refresh()},45000);

/* Instalación Android y registro PWA de alcance raíz, disponible antes de iniciar sesión. */
document.querySelectorAll('[data-install-pwa]').forEach(button=>{
 button.addEventListener('click',async()=>{
  if(pwaIsStandalone())return;
  if(!pwaInstallPrompt){showPwaGuide();return}
  const prompt=pwaInstallPrompt;
  pwaInstallPrompt=null;
  try{
   await prompt.prompt();
   const answer=await prompt.userChoice;
   if(answer?.outcome==='accepted')toast('Instalación iniciada. Busca MegaBot entre las aplicaciones de tu POCO.');
  }catch(err){
   console.warn('Instalación mediante Chrome no disponible',err);
   showPwaGuide();
  }
  updatePwaInstallButtons();
 });
});
$('#pwaHelpClose')?.addEventListener('click',closePwaGuide);
$('#pwaInstallHelp')?.addEventListener('click',event=>{
 if(event.target.id==='pwaInstallHelp')closePwaGuide();
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')closePwaGuide();
});
updatePwaInstallButtons();
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
 navigator.serviceWorker.register('/sw.js',{scope:'/'})
  .catch(err=>console.warn('MegaBot funciona en línea, pero no pudo registrar el modo instalable',err));
}
