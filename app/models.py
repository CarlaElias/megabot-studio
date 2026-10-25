from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import create_engine, Integer, String, Numeric, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped, relationship, sessionmaker
from sqlalchemy.sql import func
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
DB_URL = os.getenv('DATABASE_URL', 'sqlite:///./data/megabot.db')
if DB_URL.startswith('sqlite:///./'):
    DB_URL = 'sqlite:///' + str(ROOT / DB_URL.replace('sqlite:///./', '', 1))
# Render Free usa IPv4: en Supabase Free configura la URI del Session pooler, no la conexión directa IPv6.
if DB_URL.startswith(('postgres://','postgresql://')):
    DB_URL = DB_URL.replace('postgres://', 'postgresql+psycopg://', 1).replace('postgresql://', 'postgresql+psycopg://', 1)
if DB_URL.startswith('postgresql+psycopg://'):
    engine = create_engine(DB_URL, pool_pre_ping=True, pool_size=2, max_overflow=1,
        connect_args={'options':'-csearch_path=megabot,public', 'sslmode':'require'})
else:
    engine = create_engine(DB_URL, pool_pre_ping=True,
        connect_args={'check_same_thread': False, 'timeout': 30} if DB_URL.startswith('sqlite:') else {})

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

class Base(DeclarativeBase): pass

def now(): return datetime.now(timezone.utc).replace(tzinfo=None)

class Admin(Base):
    __tablename__='admins'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(70), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(250), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class LoginSession(Base):
    __tablename__='login_sessions'
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey('admins.id'), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    csrf_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

class Product(Base):
    __tablename__='products'
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    category: Mapped[str] = mapped_column(String(80), default='Otros')
    description: Mapped[str] = mapped_column(String(2000), default='')
    sale_price: Mapped[Decimal] = mapped_column(Numeric(12,2), default=0)
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(12,2), default=0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    photos: Mapped[list['Photo']] = relationship(back_populates='product', cascade='all, delete-orphan')

class BranchStock(Base):
    __tablename__='branch_stocks'
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), primary_key=True)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

class BranchTransfer(Base):
    __tablename__='branch_transfers'
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), nullable=False)
    admin_id: Mapped[int] = mapped_column(ForeignKey('admins.id'), nullable=False)
    source_location: Mapped[str] = mapped_column(String(12), nullable=False)
    target_location: Mapped[str] = mapped_column(String(12), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Photo(Base):
    __tablename__='photos'
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'))
    filename: Mapped[str] = mapped_column(String(130), nullable=False)
    product: Mapped[Product] = relationship(back_populates='photos')

class Sale(Base):
    __tablename__='sales'
    id: Mapped[int] = mapped_column(primary_key=True)
    client: Mapped[str] = mapped_column(String(140), default='Cliente')
    phone: Mapped[str] = mapped_column(String(40), default='')
    payment_method: Mapped[str] = mapped_column(String(50), default='Efectivo')
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12,2), default=0)
    transport_cost: Mapped[Decimal] = mapped_column(Numeric(12,2), default=0)
    other_expenses: Mapped[Decimal] = mapped_column(Numeric(12,2), default=0)
    extra_income: Mapped[Decimal] = mapped_column(Numeric(12,2), default=0)
    location: Mapped[str] = mapped_column(String(12), default='tienda', nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='Confirmada')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    lines: Mapped[list['SaleLine']] = relationship(back_populates='sale', cascade='all, delete-orphan')

class SaleLine(Base):
    __tablename__='sale_lines'
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey('sales.id'))
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'))
    product_name: Mapped[str] = mapped_column(String(180))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12,2))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12,2))
    sale: Mapped[Sale] = relationship(back_populates='lines')

class Delivery(Base):
    __tablename__='deliveries'
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int|None] = mapped_column(ForeignKey('sales.id'), nullable=True)
    client: Mapped[str] = mapped_column(String(140), nullable=False)
    location: Mapped[str] = mapped_column(String(250), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default='Pendiente')
    notes: Mapped[str] = mapped_column(String(500), default='')
    phone: Mapped[str] = mapped_column(String(40), default='', nullable=False)
    product_summary: Mapped[str] = mapped_column(String(240), default='', nullable=False)

class GenerationJob(Base):
    __tablename__='generation_jobs'
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'))
    mode: Mapped[str] = mapped_column(String(20), default='plantillas')
    target: Mapped[int] = mapped_column(Integer, default=50)
    completed: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default='queued')
    error: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    items: Mapped[list['GeneratedImage']] = relationship(back_populates='job')

class GeneratedImage(Base):
    __tablename__='generated_images'
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey('generation_jobs.id'))
    filename: Mapped[str] = mapped_column(String(150))
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    job: Mapped[GenerationJob] = relationship(back_populates='items')

class Notification(Base):
    __tablename__='notifications'
    id: Mapped[int] = mapped_column(primary_key=True)
    message: Mapped[str] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

class Audit(Base):
    __tablename__='audit'
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int|None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(120))
    detail: Mapped[str] = mapped_column(String(500), default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

def init_db():
    Base.metadata.create_all(engine)

class PushSubscription(Base):
    __tablename__='push_subscriptions'
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey('admins.id'))
    endpoint: Mapped[str] = mapped_column(String(1500), unique=True)
    subscription_json: Mapped[str] = mapped_column(Text)

class PaymentRecord(Base):
    __tablename__='payment_records'
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey('sales.id'))
    admin_id: Mapped[int] = mapped_column(ForeignKey('admins.id'))
    amount: Mapped[Decimal] = mapped_column(Numeric(12,2))
    method: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class WholesaleProfile(Base):
    """Presentaciones mayoristas de un producto compartido con el inventario general."""
    __tablename__ = 'wholesale_profiles'
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id'), unique=True, nullable=False)
    units_per_pack: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    units_per_carton: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    min_wholesale_qty: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    wholesale_unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    pack_total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    carton_total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    other_unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    colors: Mapped[str] = mapped_column(String(350), default='')
    supplier: Mapped[str] = mapped_column(String(160), default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
