# MegaBot Integral — plataforma privada para Mega Compra

**Versión funcional de prueba**, con diseño futurista + premium en negro, rojo y dorado, y logotipo de Mega Compra incluido. El sistema está diseñado para trabajar desde el celular y la PC con **tres cuentas individuales de administrador** y una **base de datos compartida**.

## 1. Funciones incluidas (reales, no solo maquetas)

- Autenticación privada, máximo 3 administradores creados individualmente, contraseñas Argon2, cambio de contraseña con revocación de sesiones, sesiones de 3 días con cookies HttpOnly/SameSite y CSRF, bloqueo temporal tras varios intentos, fotos protegidas y auditoría.
- Productos: alta/edición, baja lógica, código SKU, precio de venta (público), costo (privado), stock, descripción y hasta **20 fotografías por producto**.
- Ventas: registro, descuentos automáticos de unidades, pagos QR/efectivo/transferencia/pendiente, **abonos adicionales posteriores**, transporte, gastos adicionales, propina/extra, saldo por cobrar y utilidad estimada. Anulación con reversión de stock (atender por separado los reembolsos).
- Agenda de entregas: cliente, lugar, fecha/hora, observaciones y cambios de estado.
- Generación por lotes de hasta **50 composiciones publicitarias locales** por producto: 15 tecnológicas, 10 catálogo, 10 ambiente, 10 promociones y 5 especiales, con variaciones de color/estructura. Estas composiciones no son 50 escenas inventadas por IA; utilizan fotos originales y conservan los productos.
- **Generación realmente por IA (opcional y facturable)** con una clave propia de API de OpenAI: edición de imágenes basada en referencias. Es una solicitud por imagen; 50 imágenes pueden tener un costo considerable y requieren revisión humana por posible error visual.
- Galería, progreso, aprobación y descarga ZIP de imágenes.
- Borradores de título + descripción para Facebook y texto TikTok (plantillas sin costo). Texto con IA disponible si configuras la API.
- Avisos persistentes dentro del sistema al finalizar un lote. Avisos nativos del navegador mientras la pestaña está abierta. Notificaciones **Web Push opcionales** para el navegador cerrado, una vez configurados HTTPS + VAPID y autorizado cada dispositivo.
- Dashboard compartido; actualización por WebSocket y respaldo de sincronización por consulta cada 12 segundos. En producción ejecutar **un solo proceso de servidor** hasta agregar Redis/pubsub externo.

**No se automatiza la publicación en Facebook Marketplace personal.** Se descargan imágenes y copian textos para publicación manual; TikTok también se publica manualmente.

## 2. Ejecutar por primera vez en Windows (VS Code)

Requisitos: Python 3.11+ y PowerShell. **Para probar no necesitas MySQL**, se utiliza SQLite local.

1. Descomprime el ZIP, abre la carpeta `MegaBot_Integral` con VS Code.
2. Abre Terminal → New Terminal y ejecuta:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

3. Crea tus **tres cuentas de administrador** (cada ejecución te pide el usuario, nombre y contraseña, no escribas contraseñas en este chat):

```powershell
python manage.py create-admin
python manage.py create-admin
python manage.py create-admin
python manage.py admins
```

4. Inicia el servidor local:

```powershell
uvicorn app.main:app --reload
```

5. Abre **http://127.0.0.1:8000** y entra con uno de los administradores. Si usas `localhost` en lugar de `127.0.0.1`, revisa `ALLOWED_ORIGIN` para evitar errores CSRF (o mantén la URL indicada).

El sistema funciona localmente sin conexión de red externa para inventario, ventas, entregas y diseños por plantillas. Los otros dos administradores podrán ver los mismos datos si acceden al **mismo servidor** (no si cada uno instala su propia copia SQLite).

## 3. Usar MegaBot en 3 celulares/computadoras por Internet

No basta con abrir un archivo local: necesitas un servidor encendido (VPS o equipo con acceso seguro), un dominio y HTTPS. El proyecto contiene `Dockerfile`, `compose.yaml` y `Caddyfile` para orientar un despliegue con MySQL y HTTPS. En tu servidor Linux:

1. Instala Docker y el plugin Docker Compose, configura el DNS A de tu dominio al servidor, abre los puertos 80 y 443.
2. Copia `.env.production.example` a `.env` y define `DOMAIN`, contraseñas seguras de MySQL y opcionalmente las claves de API.
3. Ejecuta `docker compose up -d --build`.
4. Crea los 3 administradores **en la misma base de datos compartida**: `docker compose exec app python manage.py create-admin` (3 veces).
5. Entra a `https://TU_DOMINIO` desde PC y móvil. Los tres verán el mismo inventario y ventas en tiempo real (WebSocket + consultas de respaldo).

Antes de usar un entorno público con dinero y datos reales: revisar firewall, hacer backups automatizados del servidor, activar doble factor (2FA), monitoreo, control de errores, cifrado de backups, restauración de prueba y migraciones versionadas (Alembic). Estas mejoras **no vienen completas en esta versión**. No está auditado formalmente para producción.

## 4. Generación de imágenes y costos

- **Plantillas sin IA:** registra el producto y sube fotografías, entra a `Estudio IA`, elige `50 diseños locales sin API`, pulsa Iniciar. Se genera una cola de hasta 50 composiciones con tu marca. El servidor debe quedar encendido mientras procesa.
- **Con IA real:** adquiere y administra una API key de OpenAI desde su portal, agrega `OPENAI_API_KEY=...` en `.env` y configura límite y modelo compatibles. Elige modo IA y **confirma** el posible cargo. Nunca subas la clave ni `.env` a GitHub. Una suscripción a ChatGPT Plus no incluye por sí sola el consumo de API.
- Los prompts usan únicamente el nombre, descripción, precio público y foto. Costos, gastos y ganancias no se envían para hacer anuncios.
- El motor usa la API de edición `images.edit`. El proveedor/modelo puede requerir acceso de cuenta, facturación y parámetros compatibles; si falla, quedará registrado el error para corregir la configuración.

## 5. Avisos al finalizar

Sin configuración extra: aviso persistente en «Notificaciones» y aviso nativo si la pestaña continúa abierta y autorizas notificaciones.

Para avisos push con la pestaña cerrada: habilita HTTPS, configura en `.env` `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` generadas con herramientas de VAPID, reinicia, entra en MegaBot y pulsa «Activar avisos en este dispositivo». El navegador debe permitir push y no todas las configuraciones móviles ofrecen el mismo comportamiento.

## 6. Cálculo financiero

```
Ingreso por venta = (precio de venta × cantidad) + extras recibidos
Costo de mercancía = costo de compra × cantidad
Ganancia estimada = ingreso - costo de mercancía - transporte - otros gastos
Saldo por cobrar = ingreso - pagos recibidos
```

El saldo pendiente no se considera un gasto y la utilidad estimada no equivale al flujo de caja. Para contabilidad completa harían falta reportes de impuestos, devoluciones monetarias, descuentos, gastos generales y pagos parciales múltiples.

## 7. Seguridad y límites conocidos

1. El frontend no contiene contraseñas predefinidas; se crean por consola con contraseñas de 12+ caracteres.
2. Fotos originales y generadas se guardan en `data/private/` y solo son accesibles con sesión válida; archivos de API no están expuestos como recursos estáticos.
3. La sesión de navegador se protege mediante cookie HttpOnly y el CSRF se requiere para cambios. Para Internet, `COOKIE_SECURE=1` exige HTTPS.
4. El WebSocket se autentica y notifica cambios a usuarios conectados a ese **único** proceso web.
5. Las operaciones financieras tienen un registro de auditoría. Las cancelaciones de ventas devuelven stock, pero no registran reembolsos: hay que manejarlo administrativamente.
6. Los avisos Web Push requieren configuración explícita; no se puede garantizar su recepción sin red, permisos y servidor activo.
7. Tablas creadas automáticamente sin Alembic. Para nuevas versiones con datos reales deben implementarse migraciones.
8. No está incluida la edición de roles/permisos distintos (los tres son administradores), ni autenticación multifactor todavía.
9. El servidor SQLite local es apto para prototipos, no el modo ideal para tres operadores remotos en producción; usar MySQL como está previsto.
10. No generes 50 anuncios idénticos en Marketplace: usa la biblioteca de imágenes para seleccionar campañas y evita prácticas de spam.

## 8. Pruebas

```powershell
pip install pytest httpx
python -m pytest -q tests
```

El test de integración comprueba el inicio de sesión, controles CSRF, fotos privadas, creación de producto, anuncio, stock, ventas, pagos posteriores, ganancia, saldo, segundo administrador con datos compartidos, generación local, descarga ZIP y cierre de sesión.

## Versión Integral v2 — continuación de la base original

Esta actualización **no convierte MegaBot en un editor aislado**. Conserva acceso privado, inventario, control financiero, entregas, avisos, borradores de publicaciones y generación de imágenes, y agrega:

- Motor de 50 anuncios locales con 12 composiciones, fotos originales sin síntesis generativa, paletas y tipografías variables, marca exacta y precio dibujado por código. El modo IA externo sigue siendo opcional y puede generar cargos y alterar productos.
- Temas de apariencia Obsidiana, Índigo, Océano y Esmeralda; selección guardada en cada dispositivo.
- Creación segura del primer administrador desde el navegador mediante un código único de instalación `MEGABOT_SETUP_TOKEN`. Una vez creada la primera cuenta, el código deja de permitir altas; el primer administrador puede crear las otras dos desde «Seguridad y actividad».
- Imágenes corporativas optimizadas en WebP para bajar el peso de descarga; el PNG original sigue disponible en el ZIP de referencia.

### Despliegue de prueba en Render (costo de alojamiento: cero)

El backend completo necesita un **Render Web Service**, no un Static Site. Rama `integral-v2`, `pip install -r requirements.txt`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, plan `free`, variables `COOKIE_SECURE=1`, `ALLOWED_ORIGIN=https://TU_SERVICIO.onrender.com`, `MEGABOT_SETUP_TOKEN` largo y secreto. No instales una API IA de pago si quieres usar solo las composiciones gratuitas.

**Advertencia crítica sobre datos reales:** el disco de Render Web Service gratuito es efímero. SQLite local, fotografías, anuncios y cuentas pueden perderse cuando el servicio se reinicia, se vuelve a desplegar o se reemplaza una instancia. Esto solo es adecuado para **pruebas sin ventas ni contraseñas de producción**; NO garantiza persistencia compartida ni respaldo de datos de negocio. Para utilizar los tres administradores en operaciones reales se necesita un almacén persistente de base de datos y almacenamiento de imágenes, por ejemplo integraciones con planes gratuitos y límites separados. No confundir un servidor gratuito de prueba con una plataforma de producción.
