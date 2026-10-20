# MegaBot Studio ✦

**Estudio de publicidad para productos**, con estilos muy diferentes en colores, fondos, tipografías y composición. Primer prototipo funcional independiente y gratuito.

## Qué funciona

- 12 diseños base distintos, combinables en series de **12, 24, 36 o 50 anuncios**.
- 16 paletas de color, 12 estilos visuales, 6 tipografías y color de acento configurable.
- Varias fotografías del producto (PNG/JPG/WEBP), repartidas entre los diseños, sin alterar ni regenerar su contenido.
- Nombre, descripción, precio en Bs, contacto por WhatsApp, nombre de la tienda y logo opcional.
- Exportación individual PNG y **ZIP con toda la colección**.
- Resolución de 1080 px en formatos 4:5, 1:1 o 9:16.
- Funciona en el navegador **sin backend, sin API y sin subir fotos a servidores**.

**Importante:** Este primer módulo *no usa un modelo generativo de IA*. Usa composiciones Canvas locales para mantener la fidelidad del producto, logo y textos. No elimina automáticamente el fondo de las fotos. Para mejor acabado, usa fotografías de producto con fondo transparente (PNG). El generador visual con IA podrá añadirse en una siguiente fase si se conecta un proveedor y se definen sus costes y permisos.

## Iniciar

La forma más segura de probarlo es con un servidor estático local:

```bash
cd megabot-studio
python -m http.server 8000
```

Abre http://localhost:8000. También puedes usar la extensión **Live Server** de VS Code.

No tienes que instalar dependencias npm. Las fuentes web de Google Fonts necesitan conexión: sin Internet, se usan fuentes de reemplazo.

## Crear un repositorio de GitHub

1. Abre https://github.com/new y crea un repositorio **MegaBot-Studio** (puede ser privado).
2. Extrae el ZIP y copia todos los archivos de la carpeta `megabot-studio` a la carpeta del repositorio.
3. Sube los archivos desde **Add file → Upload files** o usa `git add .`, `git commit` y `git push`.
4. Para publicarlo mediante GitHub Pages, el repositorio debe ser apto para Pages según las condiciones de tu cuenta. En **Settings → Pages**, selecciona **Deploy from a branch** → `main` → `/ (root)` → **Save**. Revisa la URL que GitHub te muestre.

> El archivo `assets/demo-headphones.svg` es un producto de ejemplo para visualizar el estudio al abrirlo. Reemplázalo subiendo tus fotos.

## Próxima fase (integración al MegaBot real)

- Conectar catálogo, usuarios, productos y permisos administrativos del proyecto principal.
- Opcional: integración de generación de escenarios mediante IA sin permitir que modifique texto/brand/logo.
- Aprobación de anuncios antes de programar publicaciones.
- Subida de los anuncios aprobados al backend y almacenamiento de las versiones.

## Estructura

```
megabot-studio/
├── index.html
├── styles.css
├── app.js
├── assets/
│   └── demo-headphones.svg
└── README.md
```

© MegaBot Studio · prototipo de diseño local.


## Publicación 100 % gratuita en Cloudflare Pages

1. Entra a https://dash.cloudflare.com/ y abre **Workers & Pages**.
2. Selecciona **Create application → Get started → Drag and drop your files**.
3. Sube el ZIP `megabot-studio-gratis-para-cloudflare.zip` (el `index.html` está en la raíz).
4. Selecciona **Deploy site**. Obtendrás una dirección `*.pages.dev` para abrir la misma web desde distintos dispositivos.

Desde un celular, visita esa URL con Chrome o Safari y usa **Agregar a pantalla de inicio** desde el menú del navegador.

**Privacidad y límites:** todas las fotos y anuncios se procesan en el navegador del dispositivo. Los datos no se sincronizan entre dispositivos ni se almacenan en la nube. La instalación PWA puede mantener los archivos de la aplicación en caché, pero las fotos subidas no se conservan tras recargar. La generación visual con IA de terceros no forma parte de esta versión gratuita.
## Despliegue gratuito en Render

1. Conecta el repositorio público `CarlaElias/megabot-studio` en Render.
2. Crea un **Static Site** con rama `main`, comando de compilación `echo ready` y directorio público `.`.
3. La dirección `*.onrender.com` permite abrirlo en dispositivos móviles, tabletas y computadoras.

Las imágenes de los productos permanecen en la memoria del navegador y no se comparten entre dispositivos. Esta fase no incluye una API de generación de imágenes por IA.
