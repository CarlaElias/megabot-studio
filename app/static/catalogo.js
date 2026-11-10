'use strict';
/* Mega Compra · Catálogo público. Solo lee productos publicados por administración. */
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=v=>'Bs '+fmt(v);
const el={
 search:$('#productSearch'),sort:$('#sortProducts'),onlyAvailable:$('#onlyAvailable'),
 nav:$('#categoryNav'),categoryFilters:$('#categoryFilters'),grid:$('#productGrid'),
 arrivals:$('#newArrivals'),result:$('#productCount'),message:$('#catalogMessage'),
 pagination:$('#pagination'),tabs:document.querySelectorAll('[data-tab]'),
 overlay:$('#overlay'),modal:$('#productDialog'),details:$('#dialogContent'),
 drawer:$('#cartDrawer'),cartList:$('#cartList'),cartCount:$('#cartCount'),
 cartTotal:$('#cartTotal'),sendOrder:$('#sendOrder'),toast:$('#toast'),
 contact:$('#headerWhatsapp'),bottomWhatsapp:$('#bottomWhatsapp')
};
const storageKey='megacompra-catalog-cart-v2';
const state={products:[],category:'Todos',tab:'all',page:1,pageSize:16,whatsapp:'',cart:[],lastFocus:null,open:null};
function readCart(){
 try{
  const raw=JSON.parse(localStorage.getItem(storageKey)||'[]');
  if(!Array.isArray(raw))return[];
  return raw.filter(x=>Number.isInteger(x.id)&&['unit','three','dozen','case'].includes(x.tier)&&
   Number.isInteger(x.packs)&&x.packs>0&&x.packs<10001).slice(0,80);
 }catch{return[]}
}
function saveCart(){
 try{localStorage.setItem(storageKey,JSON.stringify(state.cart))}catch{}
}
function toast(msg){
 el.toast.textContent=msg;el.toast.classList.remove('hidden');
 clearTimeout(window.catalogToastTimer);
 window.catalogToastTimer=setTimeout(()=>el.toast.classList.add('hidden'),3200);
}
function getProduct(id){return state.products.find(p=>p.id===id)}
function tiers(p){
 const out=[{id:'unit',label:'Por unidad',units:1,total:Number(p.price_unit),pricePerUnit:Number(p.price_unit)}];
 if(p.price_three!==null&&Number(p.price_three)>0)out.push({
  id:'three',label:'Desde 3 unidades',units:3,total:Math.round(Number(p.price_three)*300)/100,pricePerUnit:Number(p.price_three)
 });
 if(p.price_dozen!==null&&Number(p.price_dozen)>0)out.push({
  id:'dozen',label:'Docena (12 piezas)',units:12,total:Math.round(Number(p.price_dozen)*1200)/100,pricePerUnit:Number(p.price_dozen)
 });
 if(p.price_case!==null&&Number(p.price_case)>0&&Number.isInteger(p.case_units)&&p.case_units>=2)out.push({
  id:'case',label:'Cajón ('+p.case_units+' piezas)',units:p.case_units,total:Number(p.price_case),
  pricePerUnit:Number(p.price_case)/p.case_units
 });
 return out;
}
function getTier(p,id){return tiers(p).find(t=>t.id===id)}
function unitCount(id){
 return state.cart.reduce((total,x)=>{
  if(x.id!==id)return total;
  const p=getProduct(x.id),tier=p?getTier(p,x.tier):null;
  return total+(tier?tier.units*x.packs:0);
 },0);
}
function canAdd(p,tier,packs,omitCurrent=0){
 if(!p.available||!tier||!Number.isInteger(packs)||packs<1)return false;
 if(p.available_units===null)return true;
 return unitCount(p.id)-omitCurrent+packs*tier.units<=Number(p.available_units);
}
function sanitizeCart(){
 state.cart=state.cart.filter(item=>{
  const p=getProduct(item.id);
  return Boolean(p&&p.available&&getTier(p,item.tier));
 });
 // Si cambió la disponibilidad, conservamos solo cantidades que aún quepan.
 const counted={};
 state.cart=state.cart.map(item=>{
  const p=getProduct(item.id),tier=getTier(p,item.tier);
  const available=p.available_units===null?1000000:Math.max(0,Number(p.available_units));
  const spare=available-(counted[p.id]||0);
  const packs=Math.min(item.packs,Math.floor(spare/tier.units));
  counted[p.id]=(counted[p.id]||0)+packs*tier.units;
  return {...item,packs};
 }).filter(x=>x.packs>0);
 saveCart();
}
function addToCart(id,tierId='unit',packs=1){
 const p=getProduct(id),tier=p?getTier(p,tierId):null;
 if(!p||!tier){toast('Esta presentación no está disponible.');return false}
 if(!canAdd(p,tier,packs)){toast('La cantidad solicitada supera la disponibilidad publicada.');return false}
 const line=state.cart.find(x=>x.id===id&&x.tier===tierId);
 if(line)line.packs+=packs;
 else state.cart.push({id,tier:tierId,packs});
 saveCart();renderCart();
 toast('Agregado a tu pedido: '+p.name);
 return true;
}
function qtyTotal(){
 return state.cart.reduce((sum,item)=>{
  const p=getProduct(item.id),t=p?getTier(p,item.tier):null;
  return sum+(t?t.units*item.packs:0);
 },0);
}
function orderLink(){
 if(!state.whatsapp||!state.cart.length)return'#';
 const lines=state.cart.map(item=>{
  const p=getProduct(item.id),t=getTier(p,item.tier);
  return '- '+p.name+' ('+(p.sku||'')+')\n'+
    '  '+item.packs+' × '+t.label+' = '+item.packs*t.units+' unidades\n'+
    '  Subtotal: '+money(item.packs*t.total);
 });
 const total=state.cart.reduce((sum,item)=>{
  const p=getProduct(item.id),t=getTier(p,item.tier);
  return sum+item.packs*t.total;
 },0);
 const message='Hola, Mega Compra. Quiero consultar este pedido del catálogo:\n\n'+
  lines.join('\n\n')+'\n\nTOTAL REFERENCIAL: '+money(total)+
  '\n\n¿Me confirman disponibilidad, entrega y total final?';
 return 'https://wa.me/'+state.whatsapp+'?text='+encodeURIComponent(message);
}
function renderCart(){
 let count=0,total=0;
 el.cartList.innerHTML=state.cart.map(item=>{
  const p=getProduct(item.id),t=p?getTier(p,item.tier):null;
  if(!p||!t)return'';
  count+=item.packs*t.units;total+=item.packs*t.total;
  const photo=p.photos?.[0];
  const canIncrease=canAdd(p,t,1);
  return '<div class="cart-line">'+
   (photo?'<img class="cart-photo" src="'+esc(photo)+'" alt="">':'<div class="cart-photo photo-placeholder">Sin foto</div>')+
   '<div class="cart-info"><strong>'+esc(p.name)+'</strong>'+
   '<small>'+esc(t.label)+' · '+t.units+' pieza(s) por paquete</small>'+
   '<div class="cart-line-total">'+money(item.packs*t.total)+'</div>'+
   '<div class="cart-line-actions">'+
    '<div class="qty-stepper">'+
     '<button type="button" data-cart-step="-1" data-id="'+p.id+'" data-tier="'+t.id+'" aria-label="Disminuir">−</button>'+
     '<span>'+item.packs+'</span>'+
     '<button type="button" data-cart-step="1" data-id="'+p.id+'" data-tier="'+t.id+'" '+(canIncrease?'':'disabled')+' aria-label="Aumentar">+</button>'+
    '</div><button class="cart-remove" type="button" data-cart-remove="'+p.id+'" data-tier="'+t.id+'">Quitar</button>'+
   '</div></div></div>';
 }).join('')||'<div class="cart-empty"><span>🛒</span><strong>Tu pedido está vacío</strong>Agrega productos del catálogo para consultarlos juntos por WhatsApp.</div>';
 el.cartCount.textContent=count>99?'99+':String(count);
 el.cartTotal.textContent=money(total);
 el.sendOrder.href=orderLink();
 el.sendOrder.setAttribute('aria-disabled',String(count===0));
}
function setCategory(category,scroll=true){
 state.category=category;state.page=1;
 renderCategories();renderCatalog();
 if(scroll)$('#productos').scrollIntoView({behavior:'smooth',block:'start'});
}
function categoryItems(){
 const values=[...new Set(state.products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 return ['Todos',...values];
}
function renderCategories(){
 const categories=categoryItems();
 el.nav.innerHTML=categories.map((category,i)=>
  '<button type="button" class="nav-item '+(state.category===category?'active':'')+'" data-category="'+esc(category)+'">'+
  (i===0?'☰ ':'')+esc(category)+'</button>').join('');
 const counts=Object.fromEntries(categories.map(c=>[c,c==='Todos'?state.products.length:state.products.filter(p=>p.category===c).length]));
 el.categoryFilters.innerHTML=categories.map(category=>
  '<button type="button" class="'+(category===state.category?'active':'')+'" data-category="'+esc(category)+'">'+
  esc(category)+' <span>'+counts[category]+'</span></button>').join('');
}
function getVisible(){
 const q=el.search.value.trim().toLocaleLowerCase('es');
 let products=state.products.filter(p=>{
  if(state.category!=='Todos'&&p.category!==state.category)return false;
  if((el.onlyAvailable.checked||state.tab==='available')&&!p.available)return false;
  if(state.tab==='wholesale'&&!(p.price_three!==null||p.price_dozen!==null||p.price_case!==null))return false;
  if(q&&!(p.name+' '+(p.sku||'')+' '+(p.description||'')+' '+(p.category||'')).toLocaleLowerCase('es').includes(q))return false;
  return true;
 });
 if(state.tab==='recent')products=products.sort((a,b)=>b.id-a.id).slice(0,12);
 if(el.sort.value==='name')products.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 else if(el.sort.value==='price')products.sort((a,b)=>Number(a.price_unit)-Number(b.price_unit));
 else products.sort((a,b)=>b.id-a.id);
 return products;
}
function card(p,isRecent=false){
 const photo=p.photos?.[0];
 const opts=tiers(p).filter(t=>t.id!=='unit');
 const stock=p.available?(p.available_units===null?'DISPONIBLE':p.available_units+' DISPONIBLES'):'AGOTADO';
 return '<article class="product-card">'+
   '<button type="button" class="product-photo" data-detail="'+p.id+'" aria-label="Ver '+esc(p.name)+'">'+
     (photo?'<img loading="lazy" src="'+esc(photo)+'" alt="'+esc(p.name)+'">':'<span class="photo-placeholder">Fotografía no disponible</span>')+
     '<span class="stock-tag '+(p.available?'':'out')+'">'+esc(stock)+'</span>'+
     (isRecent?'<span class="arrival-tag">NUEVO</span>':'')+
   '</button>'+
   '<div class="product-details">'+
    '<small class="product-sku">COD: '+esc(p.sku||'#'+p.id)+'</small>'+
    '<h3 class="product-title">'+esc(p.name)+'</h3>'+
    '<p class="product-description">'+esc(p.description||'Consulta las características y presentaciones disponibles.')+'</p>'+
    '<div class="product-prices"><div class="unit-label">PRECIO POR UNIDAD</div>'+
    '<div class="unit-price"><small>Bs</small> '+fmt(p.price_unit)+'</div>'+
    (opts.length?opts.map(t=>'<div class="price-tier '+(t.id==='case'?'case':'')+'"><span>'+
      esc(t.id==='three'?'Desde 3 (c/u)':t.id==='dozen'?'Docena (c/u)':'Cajón x'+t.units)+
      '</span><strong>'+money(t.id==='case'?t.total:t.pricePerUnit)+'</strong></div>').join(''):
      '<span class="tier-placeholder">Consulta precios especiales</span>')+
    '</div>'+
    '<div class="product-actions"><button type="button" data-detail="'+p.id+'">DETALLES</button>'+
     '<button class="add-button" type="button" data-add="'+p.id+'" '+(p.available&&canAdd(p,getTier(p,'unit'),1)?'':'disabled')+'>'+
      (p.available?'＋ AGREGAR':'AGOTADO')+'</button></div>'+
   '</div></article>';
}
function renderArrivals(){
 const items=state.products.slice().sort((a,b)=>b.id-a.id).slice(0,5);
 el.arrivals.innerHTML=items.length?items.map(p=>card(p,true)).join(''):
  '<div class="arrival-empty">✨ Estamos preparando nuestros nuevos ingresos. Pronto encontrarás productos y precios aquí.</div>';
}
function renderPagination(total){
 const max=Math.ceil(total/state.pageSize);
 if(max<=1){el.pagination.innerHTML='';return}
 const steps=[];
 if(state.page>1)steps.push(['prev','←']);
 const start=Math.max(1,state.page-2),end=Math.min(max,start+4);
 for(let i=start;i<=end;i++)steps.push([String(i),String(i)]);
 if(state.page<max)steps.push(['next','→']);
 el.pagination.innerHTML=steps.map(([value,label])=>'<button type="button" data-page="'+value+'" class="'+(Number(value)===state.page?'active':'')+'">'+label+'</button>').join('');
}
function renderCatalog(){
 const visible=getVisible();
 const maxPages=Math.max(1,Math.ceil(visible.length/state.pageSize));
 state.page=Math.min(state.page,maxPages);
 const items=visible.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
 el.grid.innerHTML=items.map(p=>card(p)).join('');
 el.result.textContent=visible.length+' producto'+(visible.length===1?'':'s');
 el.message.classList.toggle('hidden',items.length>0);
 if(!items.length){
  el.message.innerHTML=state.products.length?
   '<strong>Sin resultados</strong>Prueba otra búsqueda o selecciona una categoría diferente.':
   '<strong>Estamos preparando el catálogo de Mega Compra</strong>Muy pronto podrás consultar imágenes, disponibilidad y precios por unidad, desde 3, docena y cajón.';
 }
 renderPagination(visible.length);
 document.querySelectorAll('.catalog-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
}
function openModal(id){
 const p=getProduct(id);if(!p)return;
 state.lastFocus=document.activeElement;
 state.open={id,tier:'unit',packs:1};
 const photo=p.photos?.[0];
 el.details.innerHTML='<div class="modal-grid"><div>'+
  '<div class="modal-main-photo">'+(photo?'<img src="'+esc(photo)+'" id="modalMainPhoto" alt="'+esc(p.name)+'">':'<span class="photo-placeholder">Fotografía no disponible</span>')+'</div>'+
  (p.photos?.length>1?'<div class="thumbs">'+p.photos.map((url,i)=>
    '<button type="button" class="'+(i===0?'active':'')+'" data-thumb="'+i+'" aria-label="Ver foto '+(i+1)+'">'+
     '<img src="'+esc(url)+'" alt=""></button>').join('')+'</div>':'')+'</div>'+
  '<div class="modal-body"><div class="modal-meta">'+
   '<span>COD: '+esc(p.sku||'#'+p.id)+'</span>'+
   '<span>'+esc(p.category||'Otros')+'</span>'+
   '<span>'+(p.available?'DISPONIBLE':'AGOTADO')+'</span></div>'+
   '<h2 id="dialogTitle">'+esc(p.name)+'</h2><p>'+esc(p.description||'Consulta disponibilidad y modelos con Mega Compra.')+'</p>'+
   '<div class="modal-tiers">'+tiers(p).map(t=>
    '<label><input type="radio" name="modalTier" value="'+t.id+'" '+(t.id==='unit'?'checked':'')+'>'+
    '<span>'+esc(t.label)+'</span><strong>'+money(t.total)+'</strong></label>').join('')+'</div>'+
   (p.available?'<div class="modal-qty-row"><div><strong>Cantidad de paquetes</strong>'+
    '<small id="modalUnits">Equivale a 1 unidad</small></div>'+
    '<div class="qty-stepper"><button type="button" data-modal-step="-1" aria-label="Quitar paquete">−</button>'+
     '<span id="modalPacks">1</span><button type="button" data-modal-step="1" aria-label="Añadir paquete">+</button></div></div>'+
    '<button type="button" class="modal-add" id="modalAdd">＋ AGREGAR A MI PEDIDO</button>':
    '<button type="button" class="modal-add" disabled>AGOTADO TEMPORALMENTE</button>')+
   '</div></div>';
 el.modal.classList.remove('hidden');el.overlay.classList.remove('hidden');
 document.body.style.overflow='hidden';$('#dialogClose').focus();updateModal();
}
function updateModal(){
 if(!state.open)return;
 const p=getProduct(state.open.id),t=getTier(p,state.open.tier);
 if(!p||!t)return;
 const pack=$('#modalPacks'),units=$('#modalUnits'),btn=$('#modalAdd');
 if(pack)pack.textContent=state.open.packs;
 if(units)units.textContent='Equivale a '+state.open.packs*t.units+' unidades · '+money(state.open.packs*t.total);
 if(btn)btn.disabled=!canAdd(p,t,state.open.packs);
}
function closeModal(){
 if(el.modal.classList.contains('hidden'))return;
 el.modal.classList.add('hidden');state.open=null;restoreOverlay();
}
function openCart(){
 if(!el.modal.classList.contains('hidden'))closeModal();
 state.lastFocus=document.activeElement;
 renderCart();
 el.drawer.classList.remove('hidden');el.overlay.classList.remove('hidden');
 document.body.style.overflow='hidden';$('#closeCart').focus();
}
function closeCart(){
 if(el.drawer.classList.contains('hidden'))return;
 el.drawer.classList.add('hidden');restoreOverlay();
}
function restoreOverlay(){
 if(el.modal.classList.contains('hidden')&&el.drawer.classList.contains('hidden')){
  el.overlay.classList.add('hidden');document.body.style.overflow='';
  state.lastFocus?.focus?.();
 }
}
el.search.addEventListener('input',()=>{state.page=1;renderCatalog()});
el.sort.addEventListener('change',()=>{state.page=1;renderCatalog()});
el.onlyAvailable.addEventListener('change',()=>{state.page=1;renderCatalog()});
for(const node of [el.nav,el.categoryFilters]){
 node.addEventListener('click',ev=>{
  const btn=ev.target.closest('[data-category]');
  if(btn)setCategory(btn.dataset.category);
 });
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 state.tab=b.dataset.tab;state.page=1;renderCatalog();
}));
$('#clearFilters').addEventListener('click',()=>{
 el.search.value='';el.onlyAvailable.checked=false;state.tab='all';setCategory('Todos',false);
});
$('#browseProducts').addEventListener('click',()=>$('#productos').scrollIntoView({behavior:'smooth'}));
$('#showAllFromNew').addEventListener('click',()=>{
 state.tab='all';el.search.value='';setCategory('Todos');
});
for(const container of [el.grid,el.arrivals]){
 container.addEventListener('click',ev=>{
  const button=ev.target.closest('button');
  if(!button)return;
  if(button.hasAttribute('data-detail'))openModal(Number(button.dataset.detail));
  else if(button.hasAttribute('data-add')){
   if(addToCart(Number(button.dataset.add)))renderCatalog();
  }
 });
}
el.pagination.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-page]');if(!b)return;
 const value=b.dataset.page;
 state.page=value==='next'?state.page+1:value==='prev'?state.page-1:Number(value);
 renderCatalog();$('#productos').scrollIntoView({behavior:'smooth'});
});
$('#dialogClose').addEventListener('click',closeModal);
el.details.addEventListener('click',ev=>{
 const b=ev.target.closest('button');if(!b||!state.open)return;
 if(b.hasAttribute('data-thumb')){
  const p=getProduct(state.open.id),index=Number(b.dataset.thumb);
  const image=$('#modalMainPhoto');
  if(image&&p.photos[index])image.src=p.photos[index];
  document.querySelectorAll('[data-thumb]').forEach(x=>x.classList.toggle('active',x===b));
 }else if(b.hasAttribute('data-modal-step')){
  state.open.packs=Math.max(1,Math.min(999,state.open.packs+Number(b.dataset.modalStep)));
  updateModal();
 }else if(b.id==='modalAdd'){
  if(addToCart(state.open.id,state.open.tier,state.open.packs)){
   closeModal();openCart();renderCatalog();
  }
 }
});
el.details.addEventListener('change',ev=>{
 if(ev.target.matches('input[name="modalTier"]')&&state.open){
  state.open.tier=ev.target.value;state.open.packs=1;updateModal();
 }
});
$('#openCart').addEventListener('click',openCart);
$('#closeCart').addEventListener('click',closeCart);
el.overlay.addEventListener('click',()=>{closeModal();closeCart()});
el.cartList.addEventListener('click',ev=>{
 const b=ev.target.closest('button');if(!b)return;
 const id=Number(b.dataset.id||b.dataset.cartRemove),tierId=b.dataset.tier;
 const ix=state.cart.findIndex(x=>x.id===id&&x.tier===tierId);
 if(ix<0)return;
 if(b.hasAttribute('data-cart-remove'))state.cart.splice(ix,1);
 else if(b.hasAttribute('data-cart-step')){
  const delta=Number(b.dataset.cartStep),line=state.cart[ix],p=getProduct(id),tier=getTier(p,tierId);
  if(delta>0&&!canAdd(p,tier,delta)){toast('No hay suficientes unidades disponibles.');return}
  line.packs+=delta;if(line.packs<1)state.cart.splice(ix,1);
 }
 saveCart();renderCart();renderCatalog();
});
document.addEventListener('keydown',ev=>{
 if(ev.key==='Escape'){closeModal();closeCart()}
 if(ev.key==='Tab'){
  const popup=!el.drawer.classList.contains('hidden')?el.drawer:!el.modal.classList.contains('hidden')?el.modal:null;
  if(!popup)return;
  const focusable=[...popup.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')].filter(n=>n.getClientRects().length>0);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus()}
  else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus()}
 }
});
function initWhatsApp(){
 if(!state.whatsapp){
  el.contact.classList.add('hidden');el.bottomWhatsapp.classList.add('hidden');return;
 }
 const message='Hola Mega Compra, quisiera consultar su catálogo de productos por menor y mayor.';
 const url='https://wa.me/'+state.whatsapp+'?text='+encodeURIComponent(message);
 el.contact.href=url;el.bottomWhatsapp.href=url;
}
async function loadCatalog(){
 try{
  const response=await fetch('/api/catalogo/publico',{credentials:'omit',cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  state.products=Array.isArray(data.products)?data.products.filter(x=>Number(x.price_unit)>0):[];
  state.whatsapp=/^\d{8,15}$/.test(String(data.whatsapp||''))?String(data.whatsapp):'';
  state.cart=readCart();
  sanitizeCart();
  initWhatsApp();renderCategories();renderArrivals();renderCatalog();renderCart();
 }catch(e){
  console.error('Error cargando catálogo',e);
  el.result.textContent='Sin conexión';
  el.message.classList.remove('hidden');
  el.message.innerHTML='<strong>No pudimos cargar el catálogo.</strong>Comprueba tu conexión a Internet y actualiza esta página.';
  el.arrivals.innerHTML='<div class="arrival-empty">Las novedades no están disponibles temporalmente.</div>';
  renderCart();
 }
}
loadCatalog();
