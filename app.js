'use strict';

/** MegaBot Studio: diseños generados localmente en Canvas, sin IA ni envío de archivos. */
const $ = id => document.getElementById(id);
const state = { photos: [], activePhoto: 0, logo: null, count: 12, accent: '#8055ff', generated: [], busy: false };
const COLORS = ['#8055ff', '#ff6b35', '#0bb7a7', '#ff4d91', '#2575fc', '#101727', '#edb23a'];
const FORMATS = {portrait:[1080,1350],square:[1080,1080],story:[1080,1920]};
const FONTS = {bold:'Archivo Black',modern:'Space Grotesk',sans:'Manrope',poster:'Bebas Neue',serif:'Playfair Display',narrow:'Oswald'};
const THEMES = [
  {bg:'#ffdf65',ink:'#181722',aux:'#ff6c38',light:'#fff7d9',edge:'#edac36',name:'POP'},
  {bg:'#1a1644',ink:'#ffffff',aux:'#f94ca6',light:'#c2fbfa',edge:'#6653c8',name:'AURORA'},
  {bg:'#f7efe4',ink:'#29241d',aux:'#9d4e3f',light:'#fffdf8',edge:'#dbd0c1',name:'MINIMAL'},
  {bg:'#e4ff5c',ink:'#211a4b',aux:'#7956ff',light:'#ffffff',edge:'#acd02c',name:'FLASH'},
  {bg:'#0c1519',ink:'#e9fff5',aux:'#d3ff52',light:'#1d3439',edge:'#446764',name:'GRID'},
  {bg:'#f7dff0',ink:'#523266',aux:'#42b8ca',light:'#fffefa',edge:'#efb5df',name:'PASTEL'},
  {bg:'#1645e9',ink:'#ffffff',aux:'#a6ecff',light:'#eff4ff',edge:'#476ff7',name:'BLUE'},
  {bg:'#ff715c',ink:'#311d36',aux:'#fdff77',light:'#ffe5cb',edge:'#e8518a',name:'SUNSET'},
  {bg:'#edeae4',ink:'#161616',aux:'#e44937',light:'#ffffff',edge:'#c8c3bb',name:'EDITORIAL'},
  {bg:'#d3e4ce',ink:'#183e31',aux:'#ec915c',light:'#fff9e8',edge:'#94b39e',name:'BOTANIC'},
  {bg:'#202533',ink:'#ffffff',aux:'#71ddf0',light:'#e6ebf5',edge:'#626c7e',name:'CHROME'},
  {bg:'#6ae9d6',ink:'#2e2053',aux:'#ff69b4',light:'#fff4fc',edge:'#4ab7a8',name:'FUN'},
  {bg:'#e9fa79',ink:'#141a15',aux:'#278c76',light:'#ffffff',edge:'#c3d66d',name:'LIME'},
  {bg:'#20201d',ink:'#f9edd3',aux:'#caad71',light:'#38352e',edge:'#826f54',name:'LUX'},
  {bg:'#ffb8e2',ink:'#4d1d8e',aux:'#00c2c7',light:'#fff7fd',edge:'#cc8deb',name:'CANDY'},
  {bg:'#d3ecff',ink:'#153e7b',aux:'#ffbd57',light:'#ffffff',edge:'#86b5eb',name:'SKY'}
];
const STYLES = ['Studio Pop','Aurora Glow','Minimal Chic','Flash Sale','Tech Grid','Pastel Wave','Electric Blue','Sunset Vibes','Editorial','Organic Mood','Chrome Lab','Color Party'];
const styleFonts = [FONTS.bold,FONTS.modern,FONTS.serif,FONTS.poster,FONTS.modern,FONTS.bold,FONTS.poster,FONTS.bold,FONTS.serif,FONTS.serif,FONTS.narrow,FONTS.bold];
const svgDemo='assets/demo-headphones.svg';
let toastTimer;

function hexA(hex,a=1){const s=hex.replace('#','');const v=s.length===3?s.split('').map(q=>q+q).join(''):s;return `rgba(${parseInt(v.slice(0,2),16)},${parseInt(v.slice(2,4),16)},${parseInt(v.slice(4,6),16)},${a})`}
function mix(h1,h2,a){const toRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const v=toRgb(h1).map((n,i)=>Math.round(n*(1-a)+toRgb(h2)[i]*a));return '#'+v.map(n=>n.toString(16).padStart(2,'0')).join('')}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3400)}
function rr(c,x,y,w,h,r){const k=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+k,y);c.arcTo(x+w,y,x+w,y+h,k);c.arcTo(x+w,y+h,x,y+h,k);c.arcTo(x,y+h,x,y,k);c.arcTo(x,y,x+w,y,k);c.closePath()}
function box(c,x,y,w,h,r,color){rr(c,x,y,w,h,r);c.fillStyle=color;c.fill()}
function strokeBox(c,x,y,w,h,r,color,width=2){rr(c,x,y,w,h,r);c.strokeStyle=color;c.lineWidth=width;c.stroke()}
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,Math.max(.01,r),0,Math.PI*2);c.fillStyle=color;c.fill()}
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);c.fillStyle=color;c.fill()}
function line(c,x,y,x2,y2,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke()}
function polygon(c,pts,color){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill()}
function gradient(c,x,y,x2,y2,stops){const g=c.createLinearGradient(x,y,x2,y2);stops.forEach(([at,col])=>g.addColorStop(at,col));return g}
function font(name,px,weight=800){return `${weight} ${px}px "${name}", "Arial", sans-serif`}
function fontTxt(c,text,x,y,size,col,face=FONTS.sans,weight=800,opt={}){c.save();c.fillStyle=col;c.font=font(face,size,weight);c.textBaseline='alphabetic';c.textAlign=opt.align||'left';c.fillText(text,x,y,opt.maxWidth||undefined);c.restore()}
function paragraph(c,text,x,y,width,{size=75,min=35,maxLines=3,color='#111',face=FONTS.bold,weight=800,leading=1.04,align='left'}={}){
  const words=String(text||'').trim().split(/\s+/).filter(Boolean);if(!words.length)return y;
  let pt=size,lines;
  const makeLines=(s)=>{c.font=font(face,s,weight);const arr=[];let part='';for(const word of words){if(c.measureText(word).width>width){if(part){arr.push(part);part=''};arr.push(word);continue}const trial=part?part+' '+word:word;if(c.measureText(trial).width>width&&part){arr.push(part);part=word}else part=trial}if(part)arr.push(part);return arr};
  do{lines=makeLines(pt);if(lines.length<=maxLines)break;pt-=3}while(pt>min);
  c.save();c.beginPath();c.rect(0,0,1080,1350);c.clip();c.fillStyle=color;c.font=font(face,pt,weight);c.textAlign=align;c.textBaseline='top';lines.slice(0,maxLines).forEach((s,i)=>c.fillText(s,x,y+i*pt*leading,width));c.restore();return y+Math.min(lines.length,maxLines)*pt*leading;
}
function tracked(c,text,x,y,col='#fff',size=19,tracking=5,face=FONTS.sans){c.save();c.fillStyle=col;c.font=font(face,size,800);c.textBaseline='middle';let cx=x;for(const char of String(text||'').toUpperCase()){c.fillText(char,cx,y);cx+=c.measureText(char).width+tracking}c.restore()}
function pill(c,text,x,y,{bg='#fff',color='#000',pad=21,pt=29,h=56,face=FONTS.sans,border=null}={}){c.font=font(face,pt,800);const width=Math.min(870,c.measureText(text).width+pad*2);box(c,x,y,width,h,h/2,bg);if(border)strokeBox(c,x,y,width,h,h/2,border,2);fontTxt(c,text,x+pad,y+h/2+pt*.32,pt,color,face,800);return width}
function priceStr(v){const n=Number(v);if(!Number.isFinite(n)||n<0)return 'Bs 0';return 'Bs '+n.toLocaleString('es-BO',{maximumFractionDigits:2})}
function readInfo(){return {name:($('productName').value||'Tu producto estrella').trim(),description:($('productDesc').value||'Pídelo hoy').trim(),price:priceStr($('productPrice').value),contact:($('contact').value||'').trim(),brand:($('brandText').value||'MI TIENDA').trim().toUpperCase(),font:$('fontChoice').value,accent:state.accent}}
function photoAt(i){return state.photos.length?state.photos[i%state.photos.length].img:window.demoImage}
function imgNatural(img){return {w:img.naturalWidth||img.width||1,h:img.naturalHeight||img.height||1}}
function imageFit(c,img,x,y,w,h,margin=0){if(!img||!img.complete&&!(img.width>0))return;const {w:iw,h:ih}=imgNatural(img);const scale=Math.min((w-2*margin)/iw,(h-2*margin)/ih);const nw=iw*scale,nh=ih*scale;try{c.drawImage(img,x+(w-nw)/2,y+(h-nh)/2,nw,nh)}catch(e){/* malformed uploads are ignored */}}
function product(c,img,x,y,w,h,{bg='rgba(255,255,255,.85)',r=45,rotate=0,shadow=true,pad=20,border=null}={}){
  c.save();c.translate(x+w/2,y+h/2);c.rotate(rotate*Math.PI/180);const ax=-w/2,ay=-h/2;
  if(shadow){c.shadowColor='rgba(14,15,38,.19)';c.shadowBlur=50;c.shadowOffsetY=22}
  box(c,ax,ay,w,h,r,bg);c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0;
  if(border)strokeBox(c,ax,ay,w,h,r,border,3);
  c.save();rr(c,ax+pad*.4,ay+pad*.4,w-pad*.8,h-pad*.8,Math.max(10,r-pad*.35));c.clip();imageFit(c,img,ax+pad,ay+pad,w-pad*2,h-pad*2);c.restore();c.restore()
}
function logo(c,info,x,y,{color='#000',size=22,limit=600,icon=true}={}){
 if(state.logo&&state.logo.img){imageFit(c,state.logo.img,x,y-24,135,84,0);return;}
 if(icon){box(c,x,y-23,48,48,14,info.accent);fontTxt(c,'✦',x+11,y+14,31,'#fff',FONTS.sans,800);x+=65}
 const label=info.brand.slice(0,30);c.save();c.font=font(FONTS.sans,size,800);c.fillStyle=color;c.textBaseline='middle';c.fillText(label,x,y,limit);c.restore()
}
function contact(c,info,x,y,{textColor='#fff',bg='#13131c',width=650,h=74,center=false}={}){
 if(!info.contact)return;
 box(c,x,y,width,h,22,bg);fontTxt(c,'◉',x+25,y+48,34,textColor,FONTS.sans,700);fontTxt(c,`PEDIDOS  ${info.contact}`,x+75,y+48,Math.min(31,width/17),textColor,FONTS.sans,800,{maxWidth:width-95});
}
function base(c,t){c.fillStyle=t.bg;c.fillRect(0,0,1080,1350)}
function arcStroke(c,x,y,r,col,w=3){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.strokeStyle=col;c.lineWidth=w;c.stroke()}
function sparkle(c,x,y,s,col){polygon(c,[[x-s,y],[x-7,y-7],[x,y-s],[x+7,y-7],[x+s,y],[x+7,y+7],[x,y+s],[x-7,y+7]],col)}
function confetti(c,seed,t){for(let i=0;i<38;i++){let x=((i*113+seed*31)%1060)+10,y=((i*i*67+seed*57)%1280)+30;const cols=[t.aux,t.ink,t.light];c.save();c.translate(x,y);c.rotate(i*.71+seed*.1);box(c,-5,-13,10,26,3,cols[i%3]);c.restore()}}
function drawTemplate(c,id,t,i,info,img){
 const accent=info.accent;const title=info.name;const descr=info.description;let f=info.font==='auto'?styleFonts[id]:info.font;
 base(c,t);
 switch(id){
 case 0: // playful yellow/orange
   circle(c,1030,340,375,t.aux);circle(c,-80,1050,200,t.light);arcStroke(c,950,1050,360,hexA(t.ink,.17),11);
   sparkle(c,830,150,43,t.ink);sparkle(c,144,570,32,t.aux);
   logo(c,info,78,79,{color:t.ink});tracked(c,'EDICIÓN ESPECIAL',80,184,t.ink,20,7);
   paragraph(c,title,78,240,900,{size:91,min:51,maxLines:3,color:t.ink,face:f});
   ellipse(c,542,768,448,286,hexA(t.light,.56));product(c,img,193,568,698,530,{bg:hexA(t.light,.84),r:55,rotate:-4,pad:18});
   box(c,0,1165,1080,185,0,t.ink);fontTxt(c,info.price,77,1275,76,t.bg,FONTS.bold);contact(c,info,610,1218,{bg:t.aux,textColor:t.ink,width:418,h:76});break;
 case 1: // night glow
   {let g=c.createRadialGradient(550,580,80,550,540,780);g.addColorStop(0,'#934dc3');g.addColorStop(.43,t.bg);g.addColorStop(1,'#0d153d');c.fillStyle=g;c.fillRect(0,0,1080,1350)}
   arcStroke(c,565,667,485,hexA(t.light,.2),2);arcStroke(c,565,667,391,hexA(t.aux,.3),3);circle(c,900,260,95,hexA(t.aux,.55));
   logo(c,info,75,78,{color:'#fff'});tracked(c,'NUEVA COLECCIÓN ✦',77,180,t.light,18,5);
   product(c,img,154,270,782,700,{bg:hexA('#ffffff',.1),r:62,pad:24,border:hexA(t.light,.4)});
   paragraph(c,title,85,984,910,{size:77,min:44,maxLines:2,color:'#fff',face:f});
   fontTxt(c,descr,87,1206,27,t.light,FONTS.sans,700,{maxWidth:550});pill(c,info.price,751,1156,{bg:t.aux,color:'#fff',pt:35,h:76});
   contact(c,info,87,1256,{bg:hexA('#fff',.13),textColor:'#fff',width:700,h:72});break;
 case 2: // minimal serif
   line(c,69,118,1010,118,t.edge,2);logo(c,info,74,74,{color:t.ink,icon:false,size:25});tracked(c,'ESTILO PARA TU DÍA',77,185,t.aux,17,5);
   paragraph(c,title,74,238,930,{size:90,min:46,maxLines:3,color:t.ink,face:f,weight:700});
   box(c,65,480,950,625,7,t.light);product(c,img,121,526,840,542,{bg:'#f4ede6',r:12,shadow:false,pad:5});
   line(c,67,1140,1015,1140,t.edge,2);fontTxt(c,info.price,72,1238,74,t.ink,FONTS.serif,700);fontTxt(c,`WHATSAPP  ${info.contact}`,630,1217,26,t.aux,FONTS.sans,800,{maxWidth:390});line(c,70,1306,1010,1306,t.edge,2);break;
 case 3: // neon flash
   polygon(c,[[0,0],[1080,0],[1080,480],[0,660]],t.aux);circle(c,960,50,235,t.ink);sparkle(c,870,130,55,t.bg);
   logo(c,info,69,87,{color:t.light});tracked(c,'PRECIO QUE SORPRENDE',75,181,t.bg,19,6);
   paragraph(c,title,70,233,930,{size:105,min:60,maxLines:2,color:t.light,face:f});
   product(c,img,156,504,785,601,{bg:'#ffffff',r:16,rotate:5,pad:20});
   box(c,70,1144,940,140,21,t.ink);fontTxt(c,info.price,111,1240,90,t.bg,FONTS.poster,800);fontTxt(c,`☏ ${info.contact}`,689,1230,34,t.bg,FONTS.sans,800,{maxWidth:280});break;
 case 4: // technical grid
   for(let z=0;z<1080;z+=66){line(c,z,0,z,1350,hexA(t.aux,.10),2)}for(let z=0;z<1350;z+=66){line(c,0,z,1080,z,hexA(t.aux,.10),2)}
   arcStroke(c,533,680,490,hexA(t.aux,.34),3);arcStroke(c,533,680,315,hexA(t.aux,.2),2);
   logo(c,info,80,82,{color:t.ink});pill(c,'LIMITED DROP',80,172,{bg:t.aux,color:'#081412',pt:24,h:56});
   paragraph(c,title,81,255,926,{size:83,min:50,maxLines:3,color:t.ink,face:f});
   product(c,img,145,538,790,566,{bg:hexA(t.light,.92),r:12,pad:10,border:t.edge});
   line(c,79,1146,995,1146,t.aux,3);fontTxt(c,info.price,79,1252,87,t.aux,FONTS.modern,800);fontTxt(c,info.contact,790,1225,34,t.ink,FONTS.sans,700,{maxWidth:210});tracked(c,'CONSULTA AHORA ↗',80,1308,t.ink,17,3);break;
 case 5: // wavy pastel
   circle(c,997,20,320,t.aux);circle(c,80,790,320,'#f8a7dc');circle(c,1041,1244,283,'#ffe28d');
   logo(c,info,79,83,{color:t.ink});tracked(c,'LO QUE ESTABAS BUSCANDO',80,184,t.ink,18,3);
   paragraph(c,title,77,243,925,{size:86,min:45,maxLines:3,color:t.ink,face:f});
   product(c,img,174,530,740,600,{bg:hexA(t.light,.88),r:83,pad:35});sparkle(c,888,564,55,t.aux);sparkle(c,110,1093,47,t.ink);
   pill(c,info.price,78,1179,{bg:t.ink,color:t.light,pt:44,h:91});fontTxt(c,`PEDIDOS   ${info.contact}`,584,1231,28,t.ink,FONTS.sans,800,{maxWidth:434});break;
 case 6: // cobalt typographic
   for(let j=0;j<10;j++){line(c,j*130-100,-20,j*130+170,570,hexA(t.light,.17),15)}
   logo(c,info,74,78,{color:'#fff'});tracked(c,'HOLA, NUEVO FAVORITO',81,192,t.aux,17,6);
   paragraph(c,title,78,249,920,{size:90,min:51,maxLines:3,color:'#fff',face:f});
   box(c,79,552,924,584,28,t.light);product(c,img,111,579,860,521,{bg:'#f3f8ff',r:18,shadow:false,pad:13});
   fontTxt(c,info.price,79,1252,93,'#fff',FONTS.poster);box(c,635,1192,370,86,14,t.aux);fontTxt(c,`☏ ${info.contact}`,662,1247,35,t.bg,FONTS.modern,800,{maxWidth:320});break;
 case 7: // coral sunset
   {let g=gradient(c,0,0,1000,1350,[[0,'#ffbd7a'],[.47,t.bg],[1,'#f54c91']]);c.fillStyle=g;c.fillRect(0,0,1080,1350)}
   circle(c,900,570,330,t.aux);circle(c,140,390,215,'#ffbd75');
   logo(c,info,77,81,{color:t.ink});tracked(c,'TU MOMENTO ES AHORA',78,182,t.ink,18,4);
   paragraph(c,title,77,245,925,{size:83,min:51,maxLines:3,color:t.ink,face:f});
   product(c,img,162,555,772,561,{bg:hexA('#fff7e7',.77),r:160,pad:25});
   box(c,0,1178,1080,172,0,t.ink);fontTxt(c,info.price,75,1288,85,t.aux,FONTS.bold);fontTxt(c,`PEDIDOS: ${info.contact}`,624,1274,31,'#fff',FONTS.modern,800,{maxWidth:360});break;
 case 8: // magazine
   box(c,63,65,954,125,0,t.ink);tracked(c,info.brand,87,128,'#fff',29,3);fontTxt(c,'N.º 01',862,139,25,'#fff',FONTS.sans,600);
   paragraph(c,title,71,235,936,{size:89,min:46,maxLines:3,color:t.ink,face:f,weight:700});
   line(c,68,492,1017,492,t.ink,3);tracked(c,'SELECCIÓN DESTACADA',75,529,t.aux,15,6);
   product(c,img,72,558,936,537,{bg:'#faf9f6',r:3,pad:0,shadow:false});
   box(c,66,1126,460,155,0,t.aux);fontTxt(c,info.price,91,1226,73,'#fff',FONTS.poster);
   fontTxt(c,'COMPRA POR WHATSAPP ↗',570,1184,23,t.ink,FONTS.sans,800);fontTxt(c,info.contact,570,1254,51,t.ink,FONTS.modern,800,{maxWidth:432});break;
 case 9: // green nature
   for(let k=0;k<9;k++){c.save();c.translate((k*170)%1080,(k*250+250)%1350);c.rotate(k*.65);c.beginPath();c.ellipse(0,0,30,112,0,0,Math.PI*2);c.strokeStyle=hexA(t.ink,.14);c.lineWidth=4;c.stroke();c.restore()}
   logo(c,info,75,82,{color:t.ink});pill(c,'NUESTROS FAVORITOS',76,165,{bg:t.ink,color:t.light,pt:18,h:50});
   paragraph(c,title,77,245,923,{size:85,min:46,maxLines:3,color:t.ink,face:f,weight:700});
   ellipse(c,546,778,464,364,hexA(t.light,.64));product(c,img,145,533,787,583,{bg:hexA(t.light,.88),r:200,pad:22});
   fontTxt(c,info.price,75,1244,87,t.ink,FONTS.serif,800);pill(c,`☏ ${info.contact}`,628,1190,{bg:t.aux,color:'#fff',pt:28,h:74});break;
 case 10: // chrome
   {let g=gradient(c,0,0,1080,1350,[[0,'#626b7a'],[.43,t.bg],[1,'#111722']]);c.fillStyle=g;c.fillRect(0,0,1080,1350)}
   for(let k=0;k<11;k++){line(c,0,k*134,1080,k*134-80,hexA('#fff',.13),3)}
   logo(c,info,77,83,{color:'#fff'});tracked(c,'NEXT LEVEL SHOPPING',80,185,t.aux,18,5);
   paragraph(c,title,76,247,930,{size:93,min:50,maxLines:3,color:'#fff',face:f});
   arcStroke(c,540,775,411,hexA(t.aux,.6),12);product(c,img,165,537,754,567,{bg:'#e9edf3',r:42,pad:12,border:hexA('#fff',.65)});
   box(c,0,1160,1080,190,0,'#0f141e');fontTxt(c,info.price,78,1266,82,t.aux,FONTS.poster);fontTxt(c,`WHATSAPP ${info.contact}`,604,1248,29,'#fff',FONTS.sans,800,{maxWidth:403});break;
 case 11: // playful confetti
   confetti(c,i+1,t);box(c,44,51,994,336,33,t.ink);logo(c,info,80,112,{color:'#fff'});tracked(c,'ESTO TE VA A ENCANTAR',84,190,t.light,17,4);
   paragraph(c,title,79,246,930,{size:86,min:43,maxLines:2,color:'#fff',face:f});
   product(c,img,154,452,782,637,{bg:t.light,r:45,rotate:-3,pad:22});
   box(c,65,1142,950,149,35,t.ink);fontTxt(c,info.price,107,1240,84,t.light,FONTS.poster);pill(c,`☏ ${info.contact}`,644,1187,{bg:t.aux,color:'#fff',pt:27,h:73});break;
 }
 // Small distinctive brand accent, preserving readability and theme coherence.
 box(c,1007,70,20,20,5,accent);
}
function selectedTheme(i){const layout=i%STYLES.length;const variation=Math.floor(i/STYLES.length);const themeIndex=variation===0?layout:(layout+variation*5+6)%THEMES.length;return THEMES[themeIndex]}
function sizeForCanvas(){return FORMATS[$('aspect').value]||FORMATS.portrait}
function renderPoster(canvas,i,preview=false,info=null){
 const [W,H]=sizeForCanvas();const scalePreview=preview?Math.min(1,330/W):1;canvas.width=Math.round(W*scalePreview);canvas.height=Math.round(H*scalePreview);
 const c=canvas.getContext('2d',{alpha:false});c.scale(scalePreview,scalePreview);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 const theme=selectedTheme(i);const details=info||readInfo();c.fillStyle=theme.bg;c.fillRect(0,0,W,H);
 const s=Math.min(W/1080,H/1350),ox=(W-1080*s)/2,oy=(H-1350*s)/2;
 if(H>1350){for(let j=0;j<26;j++){circle(c,(j*169+i*59)%1080,(j*113+i*47)%H,8+(j%4)*5,hexA(theme.ink,.1))}tracked(c,'MEGABOT STUDIO',66,125,theme.ink,25,6);line(c,66,H-138,1013,H-138,hexA(theme.ink,.24),3);tracked(c,'DESCUBRE MÁS • ESCRÍBENOS',65,H-91,theme.ink,20,4)}
 c.save();c.translate(ox,oy);c.scale(s,s);drawTemplate(c,i%STYLES.length,theme,i,details,photoAt(i));c.restore();return canvas;
}
function previewCard(i){const item=document.createElement('article');item.className='poster-card';const box=document.createElement('div');box.className='poster-preview';const [w,h]=sizeForCanvas();box.style.aspectRatio=`${w} / ${h}`;
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',`Vista previa del diseño ${i+1}: ${STYLES[i%STYLES.length]}`);renderPoster(canvas,i,true);box.appendChild(canvas);
 const overlay=document.createElement('div');overlay.className='poster-overlay';const btn=document.createElement('button');btn.type='button';btn.textContent='↓ Descargar PNG';btn.addEventListener('click',()=>downloadSingle(i));overlay.appendChild(btn);box.appendChild(overlay);
 const meta=document.createElement('div');meta.className='poster-info';const title=document.createElement('strong');title.textContent=`${String(i+1).padStart(2,'0')} · ${STYLES[i%STYLES.length]}`;const label=document.createElement('span');label.textContent=THEMES[(i+6)%THEMES.length].name;meta.append(title,label);item.append(box,meta);return item
}
async function updateGallery({notify=false}={}){if(state.busy)return;state.busy=true;const btn=$('generateBtn');btn.disabled=true;btn.textContent='✧ Generando diseños…';
 try{await document.fonts.ready;const grid=$('galleryGrid');const frag=document.createDocumentFragment();for(let i=0;i<state.count;i++){frag.appendChild(previewCard(i));if(i>0&&i%8===0)await new Promise(r=>setTimeout(r,0))}grid.replaceChildren(frag);$('resultCount').textContent=`${state.count} diseños`;state.generated=Array.from({length:state.count},(_,i)=>i);if(notify)toast(`${state.count} anuncios creados. ¡Listos para descargar!`)}catch(e){console.error(e);toast('No se pudieron generar los diseños. Inténtalo nuevamente.')}finally{state.busy=false;btn.disabled=false;btn.innerHTML='<span>✦</span> Generar mis diseños <strong>↗</strong>'}}
function readUpload(file){return new Promise((resolve,reject)=>{if(!/^image\/(png|jpeg|webp)$/.test(file.type)){reject(new Error('Formato no compatible. Usa PNG, JPG o WEBP.'));return}if(file.size>15*1024*1024){reject(new Error('Máximo 15 MB por imagen.'));return}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>resolve({img,url,name:file.name});img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error(`No se pudo leer ${file.name}`))};img.src=url})}
async function addPhotos(files){const list=Array.from(files).slice(0,20);let added=0;for(const file of list){try{const photo=await readUpload(file);state.photos.push(photo);added++}catch(e){toast(e.message)}}if(state.photos.length>20){state.photos.splice(20).forEach(p=>URL.revokeObjectURL(p.url))}if(added){state.activePhoto=0;displayPhotos();toast(`${added} foto(s) cargada(s). Los diseños usarán tus imágenes.`);await updateGallery()}}
function displayPhotos(){const strip=$('photoStrip');strip.replaceChildren();state.photos.forEach((p,i)=>{const wrapper=document.createElement('div');wrapper.className='photo-pill'+(i===state.activePhoto?' active':'');wrapper.title=p.name;wrapper.addEventListener('click',()=>{state.activePhoto=i;const chosen=state.photos.splice(i,1)[0];state.photos.unshift(chosen);state.activePhoto=0;displayPhotos();updateGallery()});const img=document.createElement('img');img.src=p.url;img.alt=p.name;const remove=document.createElement('button');remove.type='button';remove.title='Quitar foto';remove.textContent='×';remove.addEventListener('click',(ev)=>{ev.stopPropagation();URL.revokeObjectURL(state.photos[i].url);state.photos.splice(i,1);displayPhotos();updateGallery()});wrapper.append(img,remove);strip.append(wrapper)})}
async function updateLogo(file){if(state.logo)URL.revokeObjectURL(state.logo.url);state.logo=null;if(!file)return;try{state.logo=await readUpload(file);$('logoName').textContent=file.name;$('removeLogo').hidden=false;await updateGallery()}catch(e){toast(e.message)}}
function getPng(i){return new Promise((resolve,reject)=>{const canvas=document.createElement('canvas');renderPoster(canvas,i,false);canvas.toBlob(blob=>{if(blob)resolve(blob);else reject(new Error('No se pudo guardar PNG'))},'image/png')})}
function saveBlob(blob,name){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000)}
function sanitize(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,38).toLowerCase()||'producto'}
async function downloadSingle(i){try{toast(`Preparando diseño ${i+1}…`);saveBlob(await getPng(i),`megabot-${sanitize($('productName').value)}-${String(i+1).padStart(2,'0')}.png`);toast('¡Imagen descargada en calidad 1080 px!')}catch(e){console.error(e);toast('Error al descargar. Abre el proyecto desde un servidor local o GitHub Pages.')}}
// ZIP sin dependencias externas, con entradas PNG STORE + CRC32.
const crcTable=(()=>{const tab=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);tab[n]=c>>>0}return tab})();
function crc32(buffer){let c=0xffffffff;const u=new Uint8Array(buffer);for(const b of u)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function makeZip(entries){const enc=new TextEncoder();let offset=0;const chunks=[],central=[];let cdSize=0;entries.forEach(({name,bytes})=>{const fn=enc.encode(name),data=bytes,crc=crc32(data),local=new Uint8Array(30+fn.length),view=new DataView(local.buffer);view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);view.setUint16(8,0,true);view.setUint32(14,crc,true);view.setUint32(18,data.byteLength,true);view.setUint32(22,data.byteLength,true);view.setUint16(26,fn.length,true);local.set(fn,30);chunks.push(local,data);
const cent=new Uint8Array(46+fn.length),cv=new DataView(cent.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.byteLength,true);cv.setUint32(24,data.byteLength,true);cv.setUint16(28,fn.length,true);cv.setUint32(42,offset,true);cent.set(fn,46);central.push(cent);cdSize+=cent.length;offset+=local.length+data.byteLength});
const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,cdSize,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'})}
async function downloadAll(){if(state.busy)return;const btn=$('downloadAll');btn.disabled=true;const all=[];try{for(let i=0;i<state.count;i++){btn.textContent=`Preparando ${i+1}/${state.count}…`;let blob=await getPng(i);all.push({name:`megabot-${sanitize($('productName').value)}-${String(i+1).padStart(2,'0')}.png`,bytes:await blob.arrayBuffer()});if(i%3===0)await new Promise(r=>setTimeout(r,0))}saveBlob(makeZip(all),`megabot-studio-${state.count}-disenos.zip`);toast(`¡ZIP con ${state.count} diseños descargado!`)}catch(e){console.error(e);toast('No fue posible crear el ZIP. Prueba descargando las imágenes individuales.')}finally{btn.disabled=false;btn.textContent='↓ Descargar ZIP'}}
function init(){COLORS.forEach(color=>{const dot=document.createElement('button');dot.className='accent-dot'+(color===state.accent?' active':'');dot.style.background=color;dot.type='button';dot.title=`Color ${color}`;dot.setAttribute('aria-label',`Usar color ${color}`);dot.addEventListener('click',()=>{state.accent=color;document.querySelectorAll('.accent-dot').forEach(n=>n.classList.remove('active'));dot.classList.add('active');updateGallery()});$('accents').append(dot)});
 $('quantityOptions').addEventListener('click',e=>{const b=e.target.closest('.quantity');if(!b)return;state.count=Number(b.dataset.count);document.querySelectorAll('.quantity').forEach(el=>el.classList.toggle('active',el===b));updateGallery()});
 $('generateBtn').addEventListener('click',()=>updateGallery({notify:true}));$('downloadAll').addEventListener('click',downloadAll);
 $('productPhotos').addEventListener('change',e=>{addPhotos(e.target.files);e.target.value='' });
 const drop=$('dropZone');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragging')});drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragging');addPhotos(e.dataTransfer.files)});
 $('logoFile').addEventListener('change',e=>{if(e.target.files[0])updateLogo(e.target.files[0]);e.target.value=''});$('removeLogo').addEventListener('click',()=>{if(state.logo)URL.revokeObjectURL(state.logo.url);state.logo=null;$('logoName').textContent='Se mostrará el nombre de tu tienda';$('removeLogo').hidden=true;updateGallery()});
 $('aspect').addEventListener('change',()=>updateGallery());$('fontChoice').addEventListener('change',()=>updateGallery());
 // Los inputs se actualizan al pulsar Generar; evita recalcular 50 imágenes por tecla.
 const demo=new Image();demo.onload=()=>{window.demoImage=demo;updateGallery()};demo.onerror=()=>{window.demoImage=null;updateGallery()};demo.src=svgDemo;
}
window.addEventListener('DOMContentLoaded',init);