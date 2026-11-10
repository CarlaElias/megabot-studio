'use strict';
/* Animaciones navideñas de Mega Compra, solo en el catálogo público.
   Se activan del 1 de noviembre al 6 de enero (inclusive).
   No afectan el carrito, los filtros ni el inventario. */
(function initChristmasSeason(){
 const now=new Date(),month=now.getMonth(),day=now.getDate();
 const inSeason=month===10||month===11||(month===0&&day<=6);
 if(!inSeason)return;

 const banner=document.getElementById('christmasBanner');
 const layer=document.getElementById('christmasSnow');
 const toggle=document.getElementById('christmasSnowToggle');
 if(!banner||!layer||!toggle)return;

 document.body.classList.add('christmas-theme');
 banner.hidden=false;

 // Preferencias del sistema: las personas sensibles al movimiento ven
 // las decoraciones estáticas, pero nunca animaciones ni nieve.
 const reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduceMotion){
  toggle.textContent='❄ Movimiento reducido';
  toggle.setAttribute('aria-pressed','false');
  toggle.setAttribute('aria-label','Animaciones desactivadas por la configuración del dispositivo');
  toggle.disabled=true;
  return;
 }

 let storedValue=null;
 try{storedValue=sessionStorage.getItem('megacompra-christmas-snow')}catch{}
 let enabled=storedValue!=='off';
 const mobile=window.matchMedia&&window.matchMedia('(max-width: 660px)').matches;
 const flakeCount=mobile?13:26;

 // Una sola generación, sin intervalos, eventos de scroll ni redibujo con JS.
 const holder=document.createDocumentFragment();
 for(let i=0;i<flakeCount;i++){
  const flake=document.createElement('span');
  flake.className='christmas-snowflake';
  flake.textContent=['❄','❅','❆'][i%3];
  const left=(i*37+13)%101;
  const duration=13+(i*7)%15;
  const delay=-((i*11)%27);
  const size=mobile?9+(i*5)%6:10+(i*5)%10;
  const drift=(i%2===0?1:-1)*(18+(i*7)%65);
  flake.style.setProperty('--snow-x',left+'%');
  flake.style.setProperty('--snow-duration',duration+'s');
  flake.style.setProperty('--snow-delay',delay+'s');
  flake.style.setProperty('--snow-size',size+'px');
  flake.style.setProperty('--snow-drift',drift+'px');
  holder.appendChild(flake);
 }
 layer.appendChild(holder);

 function update(){
  layer.hidden=!enabled;
  toggle.textContent=enabled?'❄ Pausar nieve':'❄ Activar nieve';
  toggle.setAttribute('aria-label',enabled?'Pausar los copos de nieve animados':'Activar los copos de nieve animados');
  toggle.setAttribute('aria-pressed',String(enabled));
 }
 toggle.addEventListener('click',function(){
  enabled=!enabled;
  try{sessionStorage.setItem('megacompra-christmas-snow',enabled?'on':'off')}catch{}
  update();
 });
 document.addEventListener('visibilitychange',function(){
  // Ahorra batería y ciclos de GPU cuando la pestaña queda en segundo plano.
  layer.classList.toggle('snow-background-paused',document.hidden);
 });
 update();
})();
