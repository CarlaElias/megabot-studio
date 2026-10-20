import hashlib, hmac, os, secrets, time
from datetime import timedelta
from fastapi import Request, HTTPException, Depends
from sqlalchemy import select
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from .models import Admin, LoginSession, SessionLocal, now

ph = PasswordHasher()
FAILED = {}

def hash_token(value): return hashlib.sha256(value.encode()).hexdigest()

def new_login(admin_id):
    token, csrf = secrets.token_urlsafe(40), secrets.token_urlsafe(32)
    expiry = now() + timedelta(days=3)
    with SessionLocal() as db:
        db.add(LoginSession(admin_id=admin_id, token_hash=hash_token(token), csrf_hash=hash_token(csrf), expires_at=expiry))
        db.commit()
    return token, csrf

def resolve(request: Request):
    token = request.cookies.get('megabot_session', '')
    if not token: raise HTTPException(401, 'Inicia sesión')
    with SessionLocal() as db:
        session = db.scalar(select(LoginSession).where(LoginSession.token_hash == hash_token(token)))
        if not session or session.expires_at < now(): raise HTTPException(401, 'Sesión vencida')
        admin = db.get(Admin, session.admin_id)
        if not admin or not admin.active: raise HTTPException(403, 'Acceso deshabilitado')
        return {'id':admin.id, 'username':admin.username, 'name':admin.display_name, 'csrf_hash':session.csrf_hash}

def authenticated(request: Request): return resolve(request)

def check_csrf(request: Request, user=Depends(authenticated)):
    csrf=request.headers.get('X-CSRF-Token', '')
    if not csrf or not hmac.compare_digest(hash_token(csrf), user['csrf_hash']):
        raise HTTPException(403, 'Token de seguridad no válido')
    origin=request.headers.get('origin')
    configured=os.getenv('ALLOWED_ORIGIN','')
    if origin and configured and origin.rstrip('/')!=configured.rstrip('/'):
        raise HTTPException(403, 'Origen no autorizado')
    return user

def login_allowed(ip):
    timestamp=time.monotonic()
    values=[x for x in FAILED.get(ip,[]) if timestamp-x<900]
    FAILED[ip]=values
    if len(values)>=8: raise HTTPException(429,'Demasiados intentos; espera 15 minutos')

def failed_login(ip):
    FAILED.setdefault(ip,[]).append(time.monotonic())

def verify_pass(plain, hashed):
    try: return ph.verify(hashed, plain)
    except (VerifyMismatchError,VerificationError): return False
