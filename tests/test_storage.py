"""Protecciones de imágenes: privadas, sin filtración de credenciales, borrado selectivo."""
from pathlib import Path
import re
import httpx
import pytest
from app import storage


def test_local_storage_keeps_originals_and_generated_separate(tmp_path, monkeypatch):
    monkeypatch.setenv('MEGABOT_STORAGE_BACKEND', 'local')
    monkeypatch.setattr(storage, 'LOCAL_DIR', tmp_path)
    original='a'*32+'.jpg'
    generated='b'*32+'.jpg'
    storage.save(original,b'\xff\xd8orig','originales')
    storage.save(generated,b'\xff\xd8gen','anuncios')
    assert storage.read(original,'originales')==b'\xff\xd8orig'
    assert storage.read(generated,'anuncios')==b'\xff\xd8gen'
    storage.delete(generated,'anuncios')
    assert storage.read(original,'originales')==b'\xff\xd8orig'
    with pytest.raises(ValueError):storage.save('../bad.jpg',b'test','originales')


def test_supabase_private_storage_routes_and_headers(monkeypatch):
    monkeypatch.setenv('MEGABOT_STORAGE_BACKEND', 'supabase')
    monkeypatch.setenv('SUPABASE_URL', 'https://storage-test.supabase.co')
    monkeypatch.setenv('SUPABASE_SECRET_KEY', 'sb_secret_fake_for_test')
    monkeypatch.setenv('SUPABASE_STORAGE_BUCKET', 'megabot-privado')
    observed=[]
    def responder(request):
        observed.append((request.method,str(request.url), request.headers['apikey'], request.headers['authorization']))
        assert request.headers.get('apikey')=='sb_secret_fake_for_test'
        return httpx.Response(200,content=b'\xff\xd8TEST')
    transport=httpx.MockTransport(responder)
    client_real=httpx.Client
    monkeypatch.setattr(storage.httpx,'Client',lambda *a,**kw:client_real(transport=transport))
    name='c'*32+'.jpg'
    storage.verify()
    storage.save(name,b'bytes','originales')
    assert storage.read(name,'originales')==b'\xff\xd8TEST'
    storage.delete(name,'originales')
    assert observed[1][1].endswith('/storage/v1/object/megabot-privado/originales/'+name)
    assert observed[2][0]=='GET' and observed[3][0]=='DELETE'


def test_remote_missing_secret_fails_closed(monkeypatch):
    monkeypatch.setenv('MEGABOT_STORAGE_BACKEND','supabase')
    monkeypatch.delenv('SUPABASE_SECRET_KEY',raising=False)
    monkeypatch.setenv('SUPABASE_URL','https://storage-test.supabase.co')
    with pytest.raises(RuntimeError,match='Falta configurar'):
        storage.verify()
