self.addEventListener('push',event=>{
 let data={title:'MegaBot',body:'Tus imágenes están listas.'};
 try{data={...data,...event.data.json()}}catch{}
 event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/static/megacompra-logo.webp',badge:'/static/megacompra-logo.webp',tag:'megabot-lote'}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow('/'))});
