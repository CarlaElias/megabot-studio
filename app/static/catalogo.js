'use strict';
const els={
 search:document.querySelector('#productSearch'),
 sort:document.querySelector('#sortProducts'),
 available:document.querySelector('#onlyAvailable'),
 categories:document.querySelector('#categoryChips'),
 grid:document.querySelector('#productGrid'),
 message:document.querySelector('#catalogMessage'),
 count:document.querySelector('#productCount'),
 dialog:document.querySelector('#productDialog'),
 details:document.querySelector('#dialogContent'),
 contact:document.querySelector('#headerWhatsapp'),
};
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[char]));
const formatPrice=v=>Number(v).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
const state={products:[],category:'Todos',whatsapp:''};
function messageLink(product,quant){
 if(!state.whatsapp)return '#';
 const detail=quant?quant:'Quisiera consultar la disponibilidad y los precios por cantidad.';
 const message='Hola, Mega Compra. Me interesa '+product.name+'. '+detail+' ¿Me ayudan con mi pedido?';
 return 'https://wa.me/'+encodeURIComponent(state.whatsapp)+'?text='+encodeURIComponent(message);
}
function tierList(p){
 const tiers=[
  ['Desde 3 unidades',p.price_three===null?null:'Bs '+formatPrice(p.price_three)+' c/u'],
  ['Por docena (12)',p.price_dozen===null?null:'Bs '+formatPrice(p.price_dozen)+' c/u'],
  [p.case_units?'Por cajón ('+p.case_units+' und.)':'Por cajón',p.price_case===null?null:'Bs '+formatPrice(p.price_case)+' el cajón']
 ];
 return tiers.filter(x=>x[1]!==null);
}
function renderCategories(){
 const categories=['Todos',...new Set(state.products.map(x=>x.category).filter(Boolean))].sort((a,b)=>{
  if(a==='Todos')return -1;if(b==='Todos')return 1;return a.localeCompare(b,'es');
 });
 els.categories.innerHTML=categories.map(category=>
  '<button type="button" data-category="'+escapeHtml(category)+'" class="'+(state.category===category?'active':'')+'">'+escapeHtml(category)+'</button>'
 ).join('');
}
function card(p){
 const photo=p.photos?.[0];
 const tiers=tierList(p);
 const badge=p.available?(p.available_units!==null?'Disponible · '+p.available_units+' unid.':'Disponible'):'Agotado';
 return '<article class="product-card">'+
  '<button class="photo-box" type="button" data-detail="'+p.id+'" aria-label="Ver '+escapeHtml(p.name)+'">'+
   (photo?'<img loading="lazy" src="'+escapeHtml(photo)+'" alt="'+escapeHtml(p.name)+'">':'<span class="photo-empty">Fotografía pendiente</span>')+
   '<span class="availability '+(p.available?'':'out')+'">'+escapeHtml(badge)+'</span></button>'+
  '<div class="card-content"><span class="category">'+escapeHtml(p.category||'Otros')+'</span>'+
  '<h3 class="product-name">'+escapeHtml(p.name)+'</h3>'+
  '<p class="product-desc">'+escapeHtml(p.description||'Consulta las características y modelos disponibles.')+'</p>'+
  '<div class="price-main"><span>Precio por unidad</span><strong>Bs '+formatPrice(p.price_unit)+'</strong></div>'+
  '<div class="price-table">'+(tiers.length?tiers.map(([label,value])=>
    '<div class="tier-row '+(label.startsWith('Por cajón')?'case':'')+'"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>'
   ).join(''):'<span class="tiers-empty">Pregunta por precios especiales por cantidad.</span>')+'</div>'+
  '<div class="card-actions"><button type="button" data-detail="'+p.id+'">Ver detalles</button>'+
  (p.available?
   '<a class="order" href="'+escapeHtml(messageLink(p,'Quiero consultar una compra.'))+'" target="_blank" rel="noopener noreferrer">Pedir por WhatsApp</a>':
   '<span class="order disabled" aria-disabled="true">Sin disponibilidad</span>')+
  '</div></div></article>';
}
function render(){
 const q=els.search.value.trim().toLocaleLowerCase('es');
 let items=state.products.filter(p=>
  (state.category==='Todos'||p.category===state.category) &&
  (!els.available.checked||p.available) &&
  (!q||(p.name+' '+(p.description||'')+' '+p.category).toLocaleLowerCase('es').includes(q))
 );
 const sort=els.sort.value;
 if(sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 else if(sort==='price')items.sort((a,b)=>a.price_unit-b.price_unit);
 else items.sort((a,b)=>b.id-a.id);
 els.grid.innerHTML=items.map(card).join('');
 els.count.textContent=items.length+' producto'+(items.length===1?'':'s');
 els.message.classList.toggle('hidden',items.length>0);
 if(!items.length)els.message.textContent=state.products.length?
   'No encontramos productos con ese filtro. Prueba otra categoría o palabra.':
   'Estamos preparando los productos del catálogo. Vuelve pronto para conocer las novedades de Mega Compra.';
}
let lastFocused=null;
function openDetails(id){
 const p=state.products.find(x=>x.id===id);if(!p)return;
 lastFocused=document.activeElement;
 const tierRows=tierList(p);
 const photos=p.photos?.length?p.photos:[];
 els.details.innerHTML='<div class="modal-grid"><div>'+
  '<div class="modal-main-photo">'+(photos[0]?'<img id="modalMainImage" src="'+escapeHtml(photos[0])+'" alt="'+escapeHtml(p.name)+'">':'Sin fotografía')+'</div>'+
  (photos.length>1?'<div class="thumbs">'+photos.map((url,i)=>
    '<button data-photo="'+i+'" class="'+(i===0?'active':'')+'" aria-label="Ver fotografía '+(i+1)+'"><img src="'+escapeHtml(url)+'" alt="Foto '+(i+1)+'"></button>'
   ).join('')+'</div>':'')+'</div><div class="modal-body"><span class="category">'+escapeHtml(p.category||'Otros')+'</span>'+
  '<h2 id="dialogTitle">'+escapeHtml(p.name)+'</h2>'+
  '<p>'+escapeHtml(p.description||'Consulta por este producto y disponibilidad.')+'</p>'+
  '<div class="modal-prices"><div class="tier-row"><span>Por unidad</span><strong>Bs '+formatPrice(p.price_unit)+'</strong></div>'+
  tierRows.map(([label,value])=>'<div class="tier-row"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>').join('')+
  '</div><div class="availability '+(p.available?'':'out')+'" style="position:static;display:inline-block;margin-bottom:14px">'+
  (p.available?'✓ Disponible':'Temporalmente agotado')+'</div>'+
  (p.available?
   '<label class="modal-quantity">¿Cuántas unidades necesitas?<select id="modalQty">'+
    '<option value="1 unidad">1 unidad</option>'+
    (p.price_three!==null?'<option value="3 unidades">3 unidades</option>':'')+
    (p.price_dozen!==null?'<option value="12 unidades">1 docena (12)</option>':'')+
    (p.price_case!==null?'<option value="1 cajón de '+p.case_units+' unidades">1 cajón de '+p.case_units+' unidades</option>':'')+
   '</select></label>'+
   '<a id="modalOrder" class="modal-order" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(messageLink(p,'Quiero 1 unidad.'))+'">Consultar por WhatsApp</a>':
   '<span class="modal-order" aria-disabled="true">Agotado temporalmente</span>')+
  '</div></div>';
 els.dialog.classList.remove('hidden');
 document.body.style.overflow='hidden';
 document.querySelector('#dialogClose').focus();
 const qty=els.details.querySelector('#modalQty'),order=els.details.querySelector('#modalOrder');
 if(qty&&order)qty.addEventListener('change',()=>{order.href=messageLink(p,'Quiero '+qty.value+'.')});
 els.details.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.photo);
  const image=els.details.querySelector('#modalMainImage');
  if(image&&photos[index])image.src=photos[index];
  els.details.querySelectorAll('[data-photo]').forEach(x=>x.classList.toggle('active',x===button));
 }));
}
function closeDetails(){
 els.dialog.classList.add('hidden');
 document.body.style.overflow='';
 lastFocused?.focus?.();
}
els.search.addEventListener('input',render);
els.sort.addEventListener('change',render);
els.available.addEventListener('change',render);
els.categories.addEventListener('click',ev=>{
 const button=ev.target.closest('[data-category]');if(!button)return;
 state.category=button.dataset.category;
 renderCategories();render();
});
els.grid.addEventListener('click',ev=>{
 const button=ev.target.closest('[data-detail]');if(button)openDetails(Number(button.dataset.detail));
});
document.querySelector('#dialogClose').addEventListener('click',closeDetails);
els.dialog.addEventListener('click',ev=>{if(ev.target===els.dialog)closeDetails()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!els.dialog.classList.contains('hidden'))closeDetails()});
(async()=>{
 try{
  const response=await fetch('/api/catalogo/publico',{credentials:'omit',cache:'no-store'});
  if(!response.ok)throw Error('Error temporal');
  const data=await response.json();
  state.products=Array.isArray(data.products)?data.products:[];
  state.whatsapp=/^\d{8,15}$/.test(String(data.whatsapp||''))?data.whatsapp:'';
  if(state.whatsapp)els.contact.href='https://wa.me/'+state.whatsapp+'?text='+encodeURIComponent('Hola, Mega Compra. Quisiera consultar su catálogo.');
  else els.contact.classList.add('hidden');
  renderCategories();render();
 }catch(err){
  console.error('No se pudo cargar el catálogo',err);
  els.message.textContent='No se pudo cargar el catálogo. Comprueba tu conexión y vuelve a actualizar la página.';
  els.count.textContent='Sin conexión';
 }
})();
