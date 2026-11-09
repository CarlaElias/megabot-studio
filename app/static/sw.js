/* MegaBot Android: sin caché de datos privados ni respuestas de la API. */
const OFFLINE_CACHE='megabot-offline-v1';
const OFFLINE_PAGE='/static/offline.html';

self.addEventListener('install',event=>{
 event.waitUntil(
  caches.open(OFFLINE_CACHE).then(cache=>cache.add(OFFLINE_PAGE))
   .then(()=>self.skipWaiting())
 );
});
self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys().then(keys=>Promise.all(
   keys.filter(key=>key.startsWith('megabot-offline-')&&key!==OFFLINE_CACHE)
       .map(key=>caches.delete(key))
  )).then(()=>self.clients.claim())
 );
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
 // El panel siempre se solicita por Internet. Solo se almacena la pantalla pública
 // de "sin conexión", nunca inventarios, ventas, fotos, sesiones ni credenciales.
 event.respondWith(
  fetch(event.request).catch(()=>caches.match(OFFLINE_PAGE))
 );
});
self.addEventListener('push',event=>{
 let data={title:'MegaBot',body:'Tus novedades están listas.'};
 try{if(event.data)data={...data,...event.data.json()}}catch{}
 event.waitUntil(self.registration.showNotification(data.title,{
  body:data.body,
  icon:'/static/megacompra-logo.webp',
  badge:'/static/megabot-icon-192.webp',
  tag:'megabot-novedad'
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(
  self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
   const open=windows.find(w=>w.url.startsWith(self.registration.scope));
   if(open)return open.focus();
   return self.clients.openWindow('/');
  })
 );
});
