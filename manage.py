"""Comandos locales para crear hasta tres administradores, sin contraseñas predefinidas."""
from argparse import ArgumentParser
from getpass import getpass
from sqlalchemy import select, func
from app.models import init_db, SessionLocal, Admin
from app.security import ph

parser=ArgumentParser()
parser.add_argument('command', choices=['create-admin','admins'])
args=parser.parse_args()
init_db()
with SessionLocal() as db:
    if args.command=='admins':
        for a in db.scalars(select(Admin).order_by(Admin.id)):
            print(a.id,a.username,a.display_name,'activo' if a.active else 'inactivo')
    else:
        if db.scalar(select(func.count()).select_from(Admin))>=3:
            raise SystemExit('Ya existen tres cuentas de administrador.')
        username=input('Usuario (sin espacios): ').strip().lower()
        display_name=input('Nombre visible: ').strip()
        if len(username)<3 or len(username)>70 or not username.replace('_','').isalnum() or not display_name:
            raise SystemExit('Usuario o nombre inválido.')
        if db.scalar(select(Admin).where(Admin.username==username)):
            raise SystemExit('El usuario ya existe.')
        password=getpass('Contraseña (mínimo 12 caracteres): ')
        if len(password)<12: raise SystemExit('La contraseña debe contener al menos 12 caracteres.')
        if getpass('Repetir contraseña: ')!=password: raise SystemExit('No coinciden.')
        db.add(Admin(username=username, display_name=display_name, password_hash=ph.hash(password)))
        db.commit()
        print('Administrador creado:',username)
