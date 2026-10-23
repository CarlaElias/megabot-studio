import os, secrets, hashlib, asyncio, zipfile, io, uuid, hmac
from contextlib import asynccontextmanager
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from io import BytesIO
from typing import Literal
from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from PIL import Image, ImageOps, UnidentifiedImageError
from .models import (ROOT,DATA,SessionLocal,init_db,now,Admin,LoginSession,Product,Photo,
                     Sale,SaleLine,Delivery,Notification,GenerationJob,GeneratedImage,Audit,PushSubscription,PaymentRecord,WholesaleProfile)
from .security import (authenticated,check_csrf,resolve,hash_token,new_login,login_allowed,failed_login,verify_pass)
from .worker import worker_loop,FILES
from .excel_export import products_excel
from .wholesale_poster import create_wholesale_poster
from . import storage

socket_clients=set()
async def broadcast():
    for s in list(socket_clients):
        try: await s.send_json({'event':'changed'})
        except Exception: socket_clients.discard(s)

@asynccontextmanager
async def lifespan(app):
    if os.getenv('MEGABOT_REQUIRE_PERSISTENCE')=='1':
        from .models import engine
        if engine.dialect.name != 'postgresql' or not storage.is_remote():
            raise RuntimeError('Producción exige PostgreSQL + Storage privado; se evita iniciar con SQLite o disco efímero')
    init_db()
    if storage.is_remote():
        await asyncio.to_thread(storage.verify)
    runner=asyncio.create_task(worker_loop(broadcast))
    yield
    runner.cancel()
    try: await runner
    except asyncio.CancelledError: pass

app=FastAPI(title='MegaBot - Panel privado',lifespan=lifespan,docs_url=None,redoc_url=None)
app.mount('/static',StaticFiles(directory=ROOT/'app'/'static'),name='static')

@app.middleware('http')
async def headers(request,call_next):
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Cache-Control']='no-store'
    response.headers['Content-Security-Policy']="default-src 'self'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    return response

def get_db():
    with SessionLocal() as db: yield db

def money(v):
    try:
        d=Decimal(str(v))
        if not d.is_finite() or d<0 or d>Decimal('9999999999.99'): raise ValueError()
        return d.quantize(Decimal('0.01'))
    except (InvalidOperation,ValueError,TypeError):
        raise HTTPException(422,'Monto inválido')

def serial_product(p):
    return {'id':p.id,'sku':p.sku,'name':p.name,'category':p.category,'description':p.description,
            'sale_price':float(p.sale_price),'purchase_cost':float(p.purchase_cost),'stock':p.stock,
            'active':p.active,'photos':[{'id':ph.id,'url':f'/api/photos/{ph.id}'} for ph in p.photos]}

def serial_sale(s):
    items=[{'product_id':l.product_id,'name':l.product_name,'quantity':l.quantity,'unit_price':float(l.unit_price),'unit_cost':float(l.unit_cost)} for l in s.lines]
    subtotal=sum(l['quantity']*l['unit_price'] for l in items)
    cost=sum(l['quantity']*l['unit_cost'] for l in items)
    total=subtotal+float(s.extra_income)
    expenses=float(s.transport_cost+s.other_expenses)
    return {'id':s.id,'client':s.client,'phone':s.phone,'payment_method':s.payment_method,'paid_amount':float(s.paid_amount),
            'transport_cost':float(s.transport_cost),'other_expenses':float(s.other_expenses),'extra_income':float(s.extra_income),
            'status':s.status,'created_at':s.created_at.isoformat(),'items':items,'subtotal':subtotal,'total':total,
            'balance':round(max(total-float(s.paid_amount),0),2),'profit':round(total-cost-expenses,2)}

def audit(db,user,action,detail=''):
    db.add(Audit(admin_id=user['id'],action=action,detail=detail[:500]))

@app.get('/')
def home(): return FileResponse(ROOT/'app'/'static'/'index.html')

class LoginInput(BaseModel):
    username:str
    password:str

@app.post('/api/login')
async def login(data:LoginInput,request:Request,db:Session=Depends(get_db)):
    ip=request.client.host if request.client else 'unknown'
    login_allowed(ip)
    user=db.scalar(select(Admin).where(Admin.username==data.username.strip().lower()))
    if not user or not user.active or not verify_pass(data.password,user.password_hash):
        failed_login(ip)
        raise HTTPException(401,'Usuario o contraseña incorrectos')
    token,csrf=new_login(user.id)
    response={'username':user.username,'display_name':user.display_name,'csrf':csrf}
    from fastapi.responses import JSONResponse
    res=JSONResponse(response)
    res.set_cookie('megabot_session',token,httponly=True,secure=os.getenv('COOKIE_SECURE')=='1',samesite='strict',max_age=3*86400,path='/')
    res.set_cookie('megabot_csrf',csrf,httponly=False,secure=os.getenv('COOKIE_SECURE')=='1',samesite='strict',max_age=3*86400,path='/')
    audit(db,{'id':user.id},'login')
    db.commit()
    return res


# Seguro de arranque de una única cuenta: el administrador elige su contraseña.
# Un token fuerte en MEGABOT_SETUP_TOKEN habilita SOLO la primera cuenta.
class SetupAdminInput(BaseModel):
    setup_token: str = Field(min_length=12, max_length=250)
    username: str = Field(min_length=3, max_length=70)
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=200)

class AdditionalAdminInput(BaseModel):
    username: str = Field(min_length=3,max_length=70)
    display_name: str = Field(min_length=1,max_length=100)
    password: str = Field(min_length=12,max_length=200)

def validate_new_admin(data, db):
    username=data.username.strip().lower()
    display_name=data.display_name.strip()
    if not username.replace('_','').isalnum() or not display_name:
        raise HTTPException(422,'Usuario o nombre inválido')
    if db.scalar(select(Admin).where(Admin.username == username)):
        raise HTTPException(409,'El nombre de usuario ya existe')
    from .security import ph
    return Admin(username=username,display_name=display_name,password_hash=ph.hash(data.password))

@app.get('/api/setup/status')
def setup_status(db: Session=Depends(get_db)):
    count=db.scalar(select(func.count()).select_from(Admin)) or 0
    return {'needs_setup':count==0,'setup_available':count==0 and bool(os.getenv('MEGABOT_SETUP_TOKEN'))}

@app.post('/api/setup/admin',status_code=201)
def bootstrap_admin(data:SetupAdminInput,request:Request,db:Session=Depends(get_db)):
    configured=os.getenv('MEGABOT_SETUP_TOKEN','')
    origin=request.headers.get('origin','').rstrip('/')
    allow=os.getenv('ALLOWED_ORIGIN','').rstrip('/')
    if origin and allow and origin!=allow:
        raise HTTPException(403,'Origen de instalación no autorizado')
    if not configured or not hmac.compare_digest(data.setup_token,configured):
        raise HTTPException(403,'Código de configuración inválido')
    # El token no puede crear más cuentas después de activar MegaBot.
    if db.scalar(select(func.count()).select_from(Admin)):
        raise HTTPException(409,'MegaBot ya tiene un administrador. Inicia sesión.')
    admin=validate_new_admin(data,db)
    db.add(admin)
    db.flush()
    db.add(Audit(admin_id=admin.id,action='admin.bootstrap',detail='Administrador principal configurado'))
    db.commit()
    return {'ok':True}

@app.get('/api/admins')
def list_admins(user=Depends(authenticated),db:Session=Depends(get_db)):
    return [{'username':a.username,'display_name':a.display_name,'active':a.active}
            for a in db.scalars(select(Admin).order_by(Admin.id))]

@app.post('/api/admins',status_code=201)
async def create_additional_admin(data:AdditionalAdminInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    if (db.scalar(select(func.count()).select_from(Admin)) or 0)>=3:
        raise HTTPException(409,'MegaBot admite un máximo de tres administradores')
    admin=validate_new_admin(data,db)
    db.add(admin)
    audit(db,user,'admin.create',admin.username)
    db.commit()
    await broadcast()
    return {'ok':True}

@app.get('/api/me')
def me(request:Request,user=Depends(authenticated),db:Session=Depends(get_db)):
    token=request.cookies.get('megabot_session','')
    sess=db.scalar(select(LoginSession).where(LoginSession.token_hash==hash_token(token)))
    # El CSRF se devuelve en /api/login y no en cada GET para no almacenarlo reversible en DB.
    return {'username':user['username'],'display_name':user['name'],'session_valid':True,'csrf':request.cookies.get('megabot_csrf','')}

@app.post('/api/logout')
async def logout(request:Request,user=Depends(check_csrf),db:Session=Depends(get_db)):
    token=request.cookies.get('megabot_session','')
    row=db.scalar(select(LoginSession).where(LoginSession.token_hash==hash_token(token)))
    if row: db.delete(row)
    audit(db,user,'logout');db.commit()
    from fastapi.responses import JSONResponse
    response=JSONResponse({'ok':True}); response.delete_cookie('megabot_session',path='/'); response.delete_cookie('megabot_csrf',path='/')
    return response

class ProductInput(BaseModel):
    # Ignorado al crear: TDA- se asigna en el servidor. Se acepta para compatibilidad con clientes antiguos.
    sku:str|None=Field(default=None,max_length=60)
    name:str=Field(min_length=2,max_length=180)
    category:str=Field(default='Otros',max_length=80)
    description:str=Field(default='',max_length=2000)
    sale_price:Decimal=Field(ge=0)
    purchase_cost:Decimal=Field(ge=0)
    stock:int=Field(ge=0,le=1_000_000)

@app.get('/api/products')
def products(user=Depends(authenticated),db:Session=Depends(get_db)):
    rows=db.scalars(select(Product).options(selectinload(Product.photos)).order_by(Product.id.desc())).all()
    return [serial_product(p) for p in rows]

@app.get('/api/products/excel')
def export_products_excel(user=Depends(authenticated),db:Session=Depends(get_db)):
    """Una exportación .xlsx actualizada en cada descarga; no guarda copias duplicadas."""
    rows=db.scalars(select(Product).order_by(Product.id)).all()
    content=products_excel(rows)
    return StreamingResponse(content,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition':'attachment; filename="MegaBot_Inventario.xlsx"',
                 'Cache-Control':'no-store'})

@app.post('/api/products',status_code=201)
async def new_product(data:ProductInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    # El ID de la fila evita carreras entre administradores y mantiene los códigos estables.
    p=Product(sku='PENDIENTE-'+secrets.token_hex(12),name=data.name.strip(),
              category=data.category.strip(),description=data.description,
              sale_price=money(data.sale_price),purchase_cost=money(data.purchase_cost),stock=data.stock)
    db.add(p);db.flush()
    code=f'TDA-{p.id:06d}'
    # Protección adicional si hay códigos antiguos importados con este mismo valor.
    if db.scalar(select(Product.id).where(Product.sku==code)):
        code=f'TDA-{p.id:06d}-{secrets.token_hex(3).upper()}'
    p.sku=code
    audit(db,user,'product.create',p.sku);db.commit()
    await broadcast();return serial_product(p)

@app.put('/api/products/{product_id}')
async def edit_product(product_id:int,data:ProductInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    p=db.get(Product,product_id)
    if not p: raise HTTPException(404,'Producto no encontrado')
    # SKU permanente, incluso en las actualizaciones del producto.
    for key in ('name','category','description','stock'):
        setattr(p,key,getattr(data,key).strip() if isinstance(getattr(data,key),str) else getattr(data,key))
    p.sale_price=money(data.sale_price);p.purchase_cost=money(data.purchase_cost)
    audit(db,user,'product.update',str(product_id));db.commit();await broadcast()
    return serial_product(p)

@app.post('/api/products/{product_id}/archive')
async def archive_product(product_id:int,user=Depends(check_csrf),db:Session=Depends(get_db)):
    p=db.get(Product,product_id)
    if not p:raise HTTPException(404,'Producto no encontrado')
    p.active=False;audit(db,user,'product.archive',str(product_id));db.commit();await broadcast()
    return {'ok':True}

@app.post('/api/products/{product_id}/photos',status_code=201)
async def add_photos(product_id:int,photos:list[UploadFile]=File(...),user=Depends(check_csrf),db:Session=Depends(get_db)):
    p=db.scalar(select(Product).options(selectinload(Product.photos)).where(Product.id==product_id))
    if not p: raise HTTPException(404,'Producto no encontrado')
    if not photos or len(photos)+len(p.photos)>20: raise HTTPException(422,'Límite de 20 fotos por producto')
    validated=[]
    for f in photos:
        raw=await f.read(8*1024*1024+1)
        if len(raw)>8*1024*1024: raise HTTPException(413,'Máximo 8 MB por fotografía')
        try:
            with Image.open(BytesIO(raw)) as im:
                if im.format not in ('JPEG','PNG','WEBP'):raise ValueError('Formato no permitido')
                im.verify()
            with Image.open(BytesIO(raw)) as im:
                if im.width*im.height>24_000_000:raise ValueError('Resolución demasiado grande')
                im=ImageOps.exif_transpose(im).convert('RGB');im.thumbnail((1800,1800))
                output=BytesIO(); im.save(output,format='JPEG',quality=89)
                validated.append(output.getvalue())
        except (UnidentifiedImageError,ValueError,OSError):
            raise HTTPException(422,'Solo JPG, PNG y WEBP válidas')
    created=[]
    try:
        for raw in validated:
            name=uuid.uuid4().hex+'.jpg'; await asyncio.to_thread(storage.save,name,raw,'originales');created.append(name)
            p.photos.append(Photo(filename=name))
        audit(db,user,'photo.upload',f'producto {product_id}, fotos {len(created)}')
        db.commit();await broadcast();return {'ok':True,'count':len(created)}
    except Exception:
        db.rollback()
        for n in created:
            try:await asyncio.to_thread(storage.delete,n,'originales')
            except Exception:pass
        raise

@app.get('/api/photos/{photo_id}')
def serve_photo(photo_id:int,user=Depends(authenticated),db:Session=Depends(get_db)):
    p=db.get(Photo,photo_id)
    if not p:raise HTTPException(404,'Foto no encontrada')
    try:return Response(storage.read(p.filename,'originales'),media_type='image/jpeg')
    except (FileNotFoundError,RuntimeError):raise HTTPException(404,'Fotografía no disponible')

@app.delete('/api/photos/{photo_id}')
async def remove_photo(photo_id:int,user=Depends(check_csrf),db:Session=Depends(get_db)):
    p=db.get(Photo,photo_id)
    if not p:raise HTTPException(404,'Foto no encontrada')
    try:await asyncio.to_thread(storage.delete,p.filename,'originales')
    except (FileNotFoundError,RuntimeError) as exc:
        raise HTTPException(502,'No se pudo borrar la fotografía: reintenta') from exc
    db.delete(p); audit(db,user,'photo.remove',str(photo_id));db.commit()
    await broadcast();return {'ok':True}


# Mayoristas: los mismos productos, fotos y unidades se comparten con Inventario.
class WholesaleInput(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    category: str = Field(default='Mayoristas', max_length=80)
    description: str = Field(default='', max_length=2000)
    stock: int = Field(ge=0, le=1_000_000)  # en unidades, NO en cajones
    sale_price: Decimal = Field(ge=0, le=9999999999)
    purchase_cost: Decimal = Field(ge=0, le=9999999999)
    other_unit_cost: Decimal = Field(default=0, ge=0, le=9999999999)
    units_per_pack: int = Field(ge=1, le=100000)
    units_per_carton: int = Field(ge=1, le=100000)
    min_wholesale_qty: int = Field(ge=1, le=100000)
    wholesale_unit_price: Decimal = Field(ge=0, le=9999999999)
    pack_total_price: Decimal = Field(ge=0, le=9999999999)
    carton_total_price: Decimal = Field(ge=0, le=9999999999)
    colors: str = Field(default='', max_length=350)
    supplier: str = Field(default='', max_length=160)

def _wholesale_prices(p, profile):
    from decimal import ROUND_HALF_UP
    unit_cost = p.purchase_cost + profile.other_unit_cost
    def profit(amount, units):
        return float((amount - unit_cost * units).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    def margin(amount, units):
        if not amount: return None
        return float(((amount - unit_cost * units) / amount * 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    return {
      'unit_cost': float(unit_cost),
      'retail_profit':profit(p.sale_price, 1), 'retail_margin_percent':margin(p.sale_price,1),
      'wholesale_profit':profit(profile.wholesale_unit_price,1),
      'wholesale_margin_percent':margin(profile.wholesale_unit_price,1),
      'pack_profit':profit(profile.pack_total_price,profile.units_per_pack),
      'pack_margin_percent':margin(profile.pack_total_price,profile.units_per_pack),
      'carton_profit':profit(profile.carton_total_price,profile.units_per_carton),
      'carton_margin_percent':margin(profile.carton_total_price,profile.units_per_carton),
    }

def serial_wholesale(p,profile):
    return {
       'id':profile.id, 'product_id':p.id, 'sku':p.sku, 'name':p.name,
       'category':p.category, 'description':p.description,
       'stock':p.stock, 'active':p.active, 'photo':p.photos[0].id if p.photos else None,
       'sale_price':float(p.sale_price), 'purchase_cost':float(p.purchase_cost),
       'other_unit_cost':float(profile.other_unit_cost),
       'units_per_pack':profile.units_per_pack,'units_per_carton':profile.units_per_carton,
       'min_wholesale_qty':profile.min_wholesale_qty,
       'wholesale_unit_price':float(profile.wholesale_unit_price),
       'pack_total_price':float(profile.pack_total_price),
       'carton_total_price':float(profile.carton_total_price),
       'colors':profile.colors, 'supplier':profile.supplier,
       **_wholesale_prices(p,profile)
    }

def apply_wholesale_fields(p,profile,data):
    p.name=data.name.strip();p.category=data.category.strip() or 'Mayoristas'
    p.description=data.description.strip();p.stock=data.stock
    p.sale_price=money(data.sale_price);p.purchase_cost=money(data.purchase_cost)
    for k in ('units_per_pack','units_per_carton','min_wholesale_qty'):
        setattr(profile,k,getattr(data,k))
    for k in ('wholesale_unit_price','pack_total_price','carton_total_price','other_unit_cost'):
        setattr(profile,k,money(getattr(data,k)))
    profile.colors=', '.join(dict.fromkeys(c.strip() for c in data.colors.split(',') if c.strip()))[:350]
    profile.supplier=data.supplier.strip()

@app.get('/api/wholesale')
def list_wholesale(user=Depends(authenticated),db:Session=Depends(get_db)):
    rows=db.execute(select(WholesaleProfile,Product).join(Product, WholesaleProfile.product_id==Product.id)
          .options(selectinload(Product.photos)).order_by(WholesaleProfile.id.desc())).all()
    return [serial_wholesale(p,profile) for profile,p in rows]

@app.post('/api/wholesale',status_code=201)
async def create_wholesale(data:WholesaleInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    # Crear primero el producto asigna un ID atómico; código único, sin contador inseguro.
    p=Product(sku='PENDIENTE-'+secrets.token_hex(12),name=data.name.strip(),
              category=data.category.strip() or 'Mayoristas',description=data.description.strip(),
              sale_price=money(data.sale_price),purchase_cost=money(data.purchase_cost),stock=data.stock)
    profile=WholesaleProfile(product_id=0)
    db.add(p);db.flush()
    code=f'MAY-{p.id:06d}'
    if db.scalar(select(Product.id).where(Product.sku==code)):
        code=f'MAY-{p.id:06d}-{secrets.token_hex(3).upper()}'
    p.sku=code
    profile.product_id=p.id
    apply_wholesale_fields(p,profile,data)
    db.add(profile);db.flush()
    audit(db,user,'wholesale.create',p.sku);db.commit()
    await broadcast()
    db.refresh(p)
    return serial_wholesale(p,profile)

@app.put('/api/wholesale/{profile_id}')
async def update_wholesale(profile_id:int,data:WholesaleInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    profile=db.get(WholesaleProfile,profile_id)
    if not profile:raise HTTPException(404,'Producto mayorista no encontrado')
    p=db.scalar(select(Product).options(selectinload(Product.photos)).where(Product.id==profile.product_id))
    if not p:raise HTTPException(404,'Producto no encontrado')
    apply_wholesale_fields(p,profile,data)
    audit(db,user,'wholesale.update',p.sku);db.commit()
    await broadcast()
    return serial_wholesale(p,profile)

@app.get('/api/wholesale/{profile_id}/poster')
def wholesale_poster(profile_id:int,style:Literal['premium','oferta']='premium',
                     user=Depends(authenticated),db:Session=Depends(get_db)):
    profile=db.get(WholesaleProfile,profile_id)
    if not profile:raise HTTPException(404,'Producto mayorista no encontrado')
    p=db.scalar(select(Product).options(selectinload(Product.photos)).where(Product.id==profile.product_id))
    if not p or not p.photos:raise HTTPException(422,'Sube primero una fotografía real del producto')
    from tempfile import TemporaryDirectory
    try:
        original=storage.read(p.photos[0].filename,'originales')
    except (FileNotFoundError,RuntimeError):raise HTTPException(404,'Fotografía no disponible')
    with TemporaryDirectory() as folder:
        photo_path=Path(folder)/'original.jpg'
        photo_path.write_bytes(original)
        content=create_wholesale_poster(photo_path,p,profile,style)
    return StreamingResponse(BytesIO(content),media_type='image/jpeg',headers={
        'Content-Disposition':f'attachment; filename="MegaCompra_{p.sku}_{style}.jpg"',
        'Cache-Control':'no-store'})

@app.get('/api/products/{product_id}/draft')
def draft(product_id:int,user=Depends(authenticated),db:Session=Depends(get_db)):
    p=db.get(Product,product_id)
    if not p:raise HTTPException(404,'Producto no encontrado')
    title=f'{p.name} – Bs {p.sale_price:.2f}'
    text=(f'{p.name}. {p.description.strip()}\n\nPrecio: Bs {p.sale_price:.2f}. '
          'Consulta disponibilidad por mensaje privado. Entregas y envíos previa coordinación.')
    tik=f'✨ {p.name} a Bs {p.sale_price:.2f}. Consulta por mensaje. #MegaCompra #Bolivia #Ofertas'
    return {'facebook_title':title,'facebook_description':text,'tiktok_caption':tik,
            'note':'Textos de plantilla sin IA. No revelan costos ni ganancias.'}

@app.post('/api/products/{product_id}/draft-ai')
async def draft_with_ai(product_id:int,user=Depends(check_csrf),db:Session=Depends(get_db)):
    """Generación real y opcional de textos mediante API pagada, nunca de costos privados."""
    key=os.getenv('OPENAI_API_KEY')
    if not key: raise HTTPException(422,'Falta OPENAI_API_KEY; puedes utilizar los textos de plantilla sin costo de IA.')
    p=db.get(Product,product_id)
    if not p:raise HTTPException(404,'Producto no encontrado')
    from openai import OpenAI
    import json
    prompt=(f'Producto: {p.name}\nCategoría: {p.category}\nCaracterísticas reales: {p.description}\n'
            f'Precio público: Bs {p.sale_price:.2f}\nRedes: Facebook Marketplace y TikTok.\n'
            'Escribe SOLO un objeto JSON con campos facebook_title, facebook_description y tiktok_caption. '
            'Redacta en español de Bolivia, atractivo pero natural. NO inventes funcionalidades, marcas, '
            'especificaciones, garantías, rebajas ni stock. No incluyas costos, gastos o ganancias. '
            'Incluye precio exacto y llamados a consultar disponibilidad. Publicación manual.')
    try:
        def call():
            client=OpenAI(api_key=key,timeout=45,max_retries=1)
            resp=client.chat.completions.create(model=os.getenv('TEXT_MODEL','gpt-4.1-mini'),
                messages=[{'role':'system','content':'Eres redactora profesional de productos. Responde JSON válido únicamente.'},
                          {'role':'user','content':prompt}],response_format={'type':'json_object'})
            return json.loads(resp.choices[0].message.content)
        result=await asyncio.to_thread(call)
        for k in ('facebook_title','facebook_description','tiktok_caption'):
            if not isinstance(result.get(k),str):raise ValueError('Respuesta incompleta')
        audit(db,user,'ad.generate_ai',str(product_id));db.commit()
        return {k:result[k][:3000] for k in ('facebook_title','facebook_description','tiktok_caption')}
    except Exception as e:
        raise HTTPException(502,f'No se pudo generar texto con IA: {str(e)[:180]}')

class SaleItemIn(BaseModel):
    product_id:int
    quantity:int=Field(ge=1,le=100000)
class SaleIn(BaseModel):
    client:str=Field(default='Cliente',max_length=140)
    phone:str=Field(default='',max_length=40)
    payment_method:Literal['Efectivo','QR','Transferencia','Pendiente']='Efectivo'
    paid_amount:Decimal=Field(ge=0)
    transport_cost:Decimal=Field(default=0,ge=0)
    other_expenses:Decimal=Field(default=0,ge=0)
    extra_income:Decimal=Field(default=0,ge=0)
    items:list[SaleItemIn]=Field(min_length=1,max_length=30)

@app.post('/api/sales',status_code=201)
async def create_sale(data:SaleIn,user=Depends(check_csrf),db:Session=Depends(get_db)):
    ids=[x.product_id for x in data.items]
    if len(set(ids))!=len(ids):raise HTTPException(422,'No repitas el mismo producto: aumenta su cantidad')
    products=db.scalars(select(Product).where(Product.id.in_(ids)).with_for_update()).all()
    by_id={p.id:p for p in products}
    subtotal=Decimal('0')
    for item in data.items:
        p=by_id.get(item.product_id)
        if not p or not p.active:raise HTTPException(422,f'Producto {item.product_id} no disponible')
        if p.stock<item.quantity:raise HTTPException(409,f'Sin stock suficiente: {p.name}')
        subtotal+=p.sale_price*item.quantity
    total=subtotal+money(data.extra_income)
    if money(data.paid_amount)>total:raise HTTPException(422,'Pago mayor al total de la venta')
    s=Sale(client=data.client.strip() or 'Cliente',phone=data.phone.strip(),payment_method=data.payment_method,
           paid_amount=money(data.paid_amount),transport_cost=money(data.transport_cost),
           other_expenses=money(data.other_expenses),extra_income=money(data.extra_income))
    db.add(s);db.flush()
    if s.paid_amount>0:
        db.add(PaymentRecord(sale_id=s.id,admin_id=user['id'],amount=s.paid_amount,method=s.payment_method))
    for item in data.items:
        p=by_id[item.product_id]
        p.stock-=item.quantity
        s.lines.append(SaleLine(product_id=p.id,product_name=p.name,quantity=item.quantity,
                                unit_price=p.sale_price,unit_cost=p.purchase_cost))
    audit(db,user,'sale.create',str(s.id))
    db.commit();await broadcast();return serial_sale(s)

@app.get('/api/sales')
def get_sales(user=Depends(authenticated),db:Session=Depends(get_db)):
    sales=db.scalars(select(Sale).options(selectinload(Sale.lines)).order_by(Sale.id.desc()).limit(500)).all()
    return [serial_sale(s) for s in sales]

@app.post('/api/sales/{sale_id}/cancel')
async def cancel_sale(sale_id:int,user=Depends(check_csrf),db:Session=Depends(get_db)):
    s=db.scalar(select(Sale).options(selectinload(Sale.lines)).where(Sale.id==sale_id).with_for_update())
    if not s:raise HTTPException(404,'Venta no encontrada')
    if s.status=='Cancelada':raise HTTPException(409,'Ya estaba cancelada')
    for line in s.lines:
        p=db.get(Product,line.product_id)
        if p:p.stock+=line.quantity
    s.status='Cancelada';audit(db,user,'sale.cancel',str(sale_id));db.commit();await broadcast()
    return {'ok':True}

class PaymentIn(BaseModel):
    amount:Decimal=Field(gt=0)
    method:Literal['Efectivo','QR','Transferencia']='QR'

@app.post('/api/sales/{sale_id}/payments')
async def add_payment(sale_id:int,data:PaymentIn,user=Depends(check_csrf),db:Session=Depends(get_db)):
    s=db.scalar(select(Sale).options(selectinload(Sale.lines)).where(Sale.id==sale_id).with_for_update())
    if not s or s.status!='Confirmada':raise HTTPException(404,'No se encontró una venta activa')
    amount=money(data.amount)
    if amount<=0:raise HTTPException(422,'Ingresa un abono positivo')
    total=sum((line.quantity*line.unit_price for line in s.lines),Decimal('0'))+s.extra_income
    if s.paid_amount+amount>total:raise HTTPException(422,'El abono supera el saldo por cobrar')
    s.paid_amount+=amount
    db.add(PaymentRecord(sale_id=s.id,admin_id=user['id'],amount=amount,method=data.method))
    audit(db,user,'sale.payment',f'venta {s.id}, Bs {amount:.2f}, {data.method}')
    db.commit();await broadcast()
    return serial_sale(s)

class PasswordChange(BaseModel):
    old_password:str
    new_password:str=Field(min_length=12,max_length=128)

@app.post('/api/change-password')
async def change_password(data:PasswordChange,user=Depends(check_csrf),db:Session=Depends(get_db)):
    from .security import ph
    admin=db.get(Admin,user['id'])
    if not verify_pass(data.old_password,admin.password_hash):raise HTTPException(403,'Contraseña anterior incorrecta')
    if data.old_password==data.new_password:raise HTTPException(422,'Elige una contraseña diferente')
    admin.password_hash=ph.hash(data.new_password)
    # Revocar otros dispositivos; la sesión actual permanece para confirmar éxito.
    for s in db.scalars(select(LoginSession).where(LoginSession.admin_id==admin.id)):
        db.delete(s)
    audit(db,user,'password.changed');db.commit()
    from fastapi.responses import JSONResponse
    res=JSONResponse({'ok':True,'message':'Contraseña actualizada; vuelve a iniciar sesión.'})
    res.delete_cookie('megabot_session',path='/');res.delete_cookie('megabot_csrf',path='/')
    await broadcast()
    return res

class DeliveryIn(BaseModel):
    sale_id:int|None=None
    client:str=Field(min_length=1,max_length=140)
    location:str=Field(min_length=1,max_length=250)
    scheduled_at:datetime
    notes:str=Field(default='',max_length=500)

@app.post('/api/deliveries',status_code=201)
async def create_delivery(data:DeliveryIn,user=Depends(check_csrf),db:Session=Depends(get_db)):
    if data.sale_id and not db.get(Sale,data.sale_id):raise HTTPException(422,'Venta no encontrada')
    d=Delivery(sale_id=data.sale_id,client=data.client,location=data.location,
               scheduled_at=data.scheduled_at.replace(tzinfo=None),notes=data.notes)
    db.add(d);db.flush();audit(db,user,'delivery.create',str(d.id));db.commit();await broadcast()
    return {'id':d.id}

@app.get('/api/deliveries')
def deliveries(user=Depends(authenticated),db:Session=Depends(get_db)):
    result=db.scalars(select(Delivery).order_by(Delivery.scheduled_at).limit(500)).all()
    return [{'id':d.id,'sale_id':d.sale_id,'client':d.client,'location':d.location,'scheduled_at':d.scheduled_at.isoformat(),
             'status':d.status,'notes':d.notes} for d in result]

class StatusInput(BaseModel):
    status:Literal['Pendiente','Confirmado','En camino','Entregado','Cancelado']
@app.patch('/api/deliveries/{delivery_id}/status')
async def delivery_status(delivery_id:int,data:StatusInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    d=db.get(Delivery,delivery_id)
    if not d:raise HTTPException(404,'Entrega no encontrada')
    d.status=data.status;audit(db,user,'delivery.status',f'{delivery_id} {data.status}');db.commit();await broadcast()
    return {'ok':True}

class JobIn(BaseModel):
    product_id:int
    mode:Literal['plantillas','ia']='plantillas'
    count:int=Field(default=50,ge=1,le=50)

@app.post('/api/jobs',status_code=201)
async def start_job(data:JobIn,user=Depends(check_csrf),db:Session=Depends(get_db)):
    p=db.scalar(select(Product).options(selectinload(Product.photos)).where(Product.id==data.product_id))
    if not p or not p.active:raise HTTPException(404,'Producto no encontrado')
    if not p.photos:raise HTTPException(422,'Agrega al menos una fotografía real')
    if data.mode=='ia':
        if not os.getenv('OPENAI_API_KEY'):
            raise HTTPException(422,'Configura OPENAI_API_KEY antes de generar imágenes pagadas')
        if data.count>int(os.getenv('MAX_AI_IMAGES_PER_JOB','50')):
            raise HTTPException(422,'Este lote supera el límite de IA configurado')
    existing=db.scalar(select(GenerationJob).where(GenerationJob.product_id==p.id,GenerationJob.status.in_(['queued','running'])))
    if existing:raise HTTPException(409,'Ya existe un lote en proceso para ese producto')
    j=GenerationJob(product_id=p.id,mode=data.mode,target=data.count)
    db.add(j);db.flush();audit(db,user,'images.start',f'lote {j.id} producto {p.id} {data.mode} {data.count}')
    db.commit();await broadcast()
    return {'id':j.id,'status':j.status,'target':j.target}

@app.get('/api/jobs')
def jobs(user=Depends(authenticated),db:Session=Depends(get_db)):
    rows=db.scalars(select(GenerationJob).order_by(GenerationJob.id.desc()).limit(100)).all()
    return [{'id':j.id,'product_id':j.product_id,'mode':j.mode,'target':j.target,'completed':j.completed,
             'status':j.status,'error':j.error,'created_at':j.created_at.isoformat()} for j in rows]

@app.get('/api/jobs/{job_id}/images')
def job_images(job_id:int,user=Depends(authenticated),db:Session=Depends(get_db)):
    if not db.get(GenerationJob,job_id):raise HTTPException(404,'Lote no encontrado')
    images=db.scalars(select(GeneratedImage).where(GeneratedImage.job_id==job_id)).all()
    return [{'id':i.id,'url':f'/api/generated/{i.id}','approved':i.approved} for i in images]

@app.get('/api/generated/{image_id}')
def serve_generated(image_id:int,user=Depends(authenticated),db:Session=Depends(get_db)):
    image=db.get(GeneratedImage,image_id)
    if not image:raise HTTPException(404,'Imagen no encontrada')
    try:return Response(storage.read(image.filename,'anuncios'),media_type='image/jpeg')
    except (FileNotFoundError,RuntimeError):raise HTTPException(404,'El archivo ya no está disponible')

@app.get('/api/generated/{image_id}/download')
def download_generated_jpg(image_id:int,user=Depends(authenticated),db:Session=Depends(get_db)):
    image=db.get(GeneratedImage,image_id)
    if not image:raise HTTPException(404,'Imagen no encontrada')
    try:content=storage.read(image.filename,'anuncios')
    except (FileNotFoundError,RuntimeError):raise HTTPException(404,'El archivo ya no está disponible')
    return Response(content,media_type='image/jpeg',headers={
        'Content-Disposition':f'attachment; filename="MegaCompra_{image.job_id}_{image.id}.jpg"'})

@app.delete('/api/jobs/{job_id}')
async def delete_generated_job(job_id:int,user=Depends(check_csrf),db:Session=Depends(get_db)):
    """Borra SOLO anuncios generados, no fotografías originales de producto."""
    job=db.get(GenerationJob,job_id)
    if not job:raise HTTPException(404,'Lote no encontrado')
    if job.status in ('queued','running'):
        raise HTTPException(409,'Espera a que el lote termine antes de borrarlo')
    images=db.scalars(select(GeneratedImage).where(GeneratedImage.job_id==job_id)).all()
    names=[image.filename for image in images]
    # Eliminar primero los objetos remotos para no perder referencias si Storage falla.
    try:
        for name in names:await asyncio.to_thread(storage.delete,name,'anuncios')
    except (FileNotFoundError,RuntimeError) as exc:
        raise HTTPException(502,'No se pudieron borrar todas las imágenes; inténtalo otra vez') from exc
    for image in images:db.delete(image)
    db.delete(job)
    audit(db,user,'images.delete',f'lote {job_id}, {len(names)} imágenes')
    db.commit()
    await broadcast()
    return {'ok':True,'deleted':len(images)}

class ApprovedInput(BaseModel):
    approved:bool
@app.patch('/api/generated/{image_id}')
async def approve(image_id:int,data:ApprovedInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    image=db.get(GeneratedImage,image_id)
    if not image:raise HTTPException(404,'Imagen no encontrada')
    image.approved=data.approved;audit(db,user,'image.approve',str(image_id));db.commit();await broadcast()
    return {'ok':True}

@app.get('/api/jobs/{job_id}/download')
def download(job_id:int,only_approved:bool=False,user=Depends(authenticated),db:Session=Depends(get_db)):
    if not db.get(GenerationJob,job_id):raise HTTPException(404,'Lote no encontrado')
    imgs=db.scalars(select(GeneratedImage).where(GeneratedImage.job_id==job_id)).all()
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as archive:
        for idx,im in enumerate(imgs,1):
            if only_approved and not im.approved:continue
            try:raw=storage.read(im.filename,'anuncios')
            except (FileNotFoundError,RuntimeError):continue
            archive.writestr(f'MegaCompra_{idx:02d}.jpg',raw)
    buf.seek(0)
    return StreamingResponse(buf,media_type='application/zip',headers={'Content-Disposition':f'attachment; filename="MegaBot_lote_{job_id}.zip"'})

@app.get('/api/notifications')
def notifications(user=Depends(authenticated),db:Session=Depends(get_db)):
    ns=db.scalars(select(Notification).order_by(Notification.id.desc()).limit(50)).all()
    return [{'id':n.id,'message':n.message,'created_at':n.created_at.isoformat()} for n in ns]

@app.get('/api/dashboard')
def dashboard(user=Depends(authenticated),db:Session=Depends(get_db)):
    products=db.scalars(select(Product).where(Product.active==True)).all()
    sales=db.scalars(select(Sale).options(selectinload(Sale.lines)).where(Sale.status=='Confirmada')).all()
    data=[serial_sale(s) for s in sales]
    jobs=db.scalars(select(GenerationJob)).all()
    return {'products':len(products),'stock':sum(x.stock for x in products),
            'investment':round(sum(float(x.purchase_cost)*x.stock for x in products),2),
            'sales_count':len(sales),'sales_total':round(sum(s['total'] for s in data),2),
            'profit_total':round(sum(s['profit'] for s in data),2),
            'pending_balance':round(sum(s['balance'] for s in data),2),
            'images':sum(j.completed for j in jobs),
            'jobs_running':sum(1 for j in jobs if j.status in ['running','queued'])}

@app.get('/api/push/config')
def push_config(user=Depends(authenticated)):
    return {'enabled':bool(os.getenv('VAPID_PUBLIC_KEY') and os.getenv('VAPID_PRIVATE_KEY')),
            'public_key':os.getenv('VAPID_PUBLIC_KEY','')}

class PushInput(BaseModel):
    endpoint:str=Field(min_length=10,max_length=1500)
    keys:dict

@app.post('/api/push/subscribe')
async def push_subscribe(data:PushInput,user=Depends(check_csrf),db:Session=Depends(get_db)):
    import json
    if not data.endpoint.startswith('https://'):
        raise HTTPException(422,'URL push no válida')
    if not {'auth','p256dh'} <= set(data.keys):
        raise HTTPException(422,'Suscripción incompleta')
    info={'endpoint':data.endpoint,'keys':{'auth':data.keys['auth'],'p256dh':data.keys['p256dh']}}
    item=db.scalar(select(PushSubscription).where(PushSubscription.endpoint==data.endpoint))
    if item:
        item.admin_id=user['id'];item.subscription_json=json.dumps(info)
    else:
        db.add(PushSubscription(admin_id=user['id'],endpoint=data.endpoint,subscription_json=json.dumps(info)))
    audit(db,user,'push.subscribe','Dispositivo autorizado')
    db.commit();return {'ok':True}

@app.get('/api/audit')
def activity(user=Depends(authenticated),db:Session=Depends(get_db)):
    rows=db.scalars(select(Audit).order_by(Audit.id.desc()).limit(80)).all()
    names={a.id:a.display_name for a in db.scalars(select(Admin)).all()}
    return [{'id':a.id,'admin':names.get(a.admin_id,'Sistema'),'action':a.action,'detail':a.detail,
             'created_at':a.created_at.isoformat()} for a in rows]

@app.websocket('/ws')
async def websocket(ws:WebSocket):
    from starlette.requests import HTTPConnection
    # Cookies are automatically carried to the websocket request.
    try:
        user=resolve(ws)
    except HTTPException:
        await ws.close(code=1008)
        return
    await ws.accept()
    socket_clients.add(ws)
    try:
        while True: await ws.receive_text()
    except (WebSocketDisconnect,RuntimeError): socket_clients.discard(ws)
