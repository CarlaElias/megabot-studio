"""Almacenamiento de imágenes original/generado: local para pruebas, privado en Supabase para producción.

No se usan URL públicas, ni llaves en el navegador. El backend verifica la sesión antes de servir fotos.
"""
import os
import re
from pathlib import Path
from urllib.parse import quote

import httpx

from .models import DATA

LOCAL_DIR = DATA / 'private'
LOCAL_DIR.mkdir(parents=True, exist_ok=True)
_NAME = re.compile(r'^[a-f0-9]{32}\.jpg$')


def is_remote():
    return os.getenv('MEGABOT_STORAGE_BACKEND', 'local').strip().lower() == 'supabase'


def _config():
    root = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_SECRET_KEY', '')
    bucket = os.getenv('SUPABASE_STORAGE_BUCKET', 'megabot-privado')
    if not root.startswith('https://') or not key or not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}', bucket):
        raise RuntimeError('Falta configurar SUPABASE_URL, SUPABASE_SECRET_KEY o un bucket válido en el servidor')
    return root, key, bucket


def _path(name, kind):
    if not _NAME.fullmatch(name):
        raise ValueError('Nombre de imagen inválido')
    if kind not in ('originales', 'anuncios'):
        raise ValueError('Tipo de imagen inválido')
    return kind + '/' + name


def _request(method, name='', kind='originales', data=None):
    url, key, bucket = _config()
    base = f'{url}/storage/v1'
    if name:
        route = f'/object/{quote(bucket, safe="")}/{quote(_path(name, kind), safe="/")}'
    else:
        route = f'/bucket/{quote(bucket, safe="")}'
    headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
    if data is not None:
        headers['Content-Type'] = 'image/jpeg'
        headers['x-upsert'] = 'false'
    try:
        with httpx.Client(timeout=40, follow_redirects=False) as client:
            response = client.request(method, base + route, headers=headers, content=data)
        if method == 'DELETE' and response.status_code == 404:
            return b''  # borrado reintentable: el objeto ya no existe
        response.raise_for_status()
        return response.content
    except httpx.HTTPStatusError as exc:
        # No mostrar respuesta completa ni credenciales, solo el código HTTP.
        raise RuntimeError(f'El almacenamiento privado devolvió HTTP {exc.response.status_code}') from None
    except httpx.RequestError as exc:
        raise RuntimeError('No fue posible comunicarse con Supabase Storage') from exc


def verify():
    if is_remote():
        _request('GET')


def save(name, raw, kind='originales'):
    if is_remote():
        _request('POST', name, kind, raw)
    else:
        _path(name, kind)
        (LOCAL_DIR/name).write_bytes(raw)


def read(name, kind='originales'):
    if is_remote():
        return _request('GET', name, kind)
    _path(name, kind)
    return (LOCAL_DIR/name).read_bytes()


def delete(name, kind='originales'):
    if is_remote():
        _request('DELETE', name, kind)
    else:
        _path(name, kind)
        (LOCAL_DIR/name).unlink(missing_ok=True)
