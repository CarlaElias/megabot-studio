"""Pruebas de integración: cuentas, permisos, inventario, ventas y contenido."""
import os, tempfile, io, time, hashlib, zipfile
from xml.etree import ElementTree as ET
from pathlib import Path
from PIL import Image

# La DB de pruebas se configura ANTES de importar módulos de la aplicación.
F=tempfile.TemporaryDirectory()
os.environ['DATABASE_URL']='sqlite:///'+str(Path(F.name)/'tests.sqlite3')
os.environ['ALLOWED_ORIGIN']='http://testserver'
from fastapi.testclient import TestClient
from app.main import app
from app.models import SessionLocal, Admin, init_db
from app.security import ph


def test_integrated_flow():
    init_db()
    with SessionLocal() as db:
        for idx in range(1,4):
            db.add(Admin(username=f'admin{idx}',display_name=f'Admin {idx}',password_hash=ph.hash(f'LongPasswordTest{idx}!')))
        db.commit()
    with TestClient(app) as c:
        assert c.get('/api/setup/status').json()['needs_setup'] is False
        assert c.get('/api/products').status_code==401
        assert c.get('/api/dashboard').status_code==401
        r=c.post('/api/login',json={'username':'admin1','password':'invalid'})
        assert r.status_code==401
        r=c.post('/api/login',json={'username':'admin1','password':'LongPasswordTest1!'})
        assert r.status_code==200
        csrf=r.json()['csrf']
        assert c.get('/api/me').status_code==200
        headers={'X-CSRF-Token':csrf}
        payload={'sku':'MC-001','name':'Aceitero de vidrio','category':'Cocina','description':'Vidrio 470ml',
                 'sale_price':40,'purchase_cost':22,'stock':5}
        assert c.post('/api/products',json=payload).status_code==403
        created=c.post('/api/products',json=payload,headers=headers)
        assert created.status_code==201, created.text
        product=created.json()
        assert product['id']>0
        response=c.get('/api/products/excel')
        assert response.status_code==200 and response.content[:2]==b'PK'
        with zipfile.ZipFile(io.BytesIO(response.content)) as book:
            xml=ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
            text=' '.join((e.text or '') for e in xml.iter())
            assert 'MC-001' in text and 'Aceitero de vidrio' in text
        updated=c.put(f'/api/products/{product["id"]}',json={**payload,'stock':7},headers=headers)
        assert updated.status_code==200
        updated_excel=c.get('/api/products/excel')
        assert updated_excel.status_code==200 and updated_excel.content!=response.content
        assert c.put(f'/api/products/{product["id"]}',json=payload,headers=headers).status_code==200
        im=Image.new('RGB',(400,400),'white');buf=io.BytesIO();im.save(buf,'PNG');buf.seek(0)
        upload=c.post(f'/api/products/{product["id"]}/photos',files={'photos':('foto.png',buf.getvalue(),'image/png')},headers=headers)
        assert upload.status_code==201, upload.text
        photo=c.get('/api/products').json()[0]['photos'][0]
        assert c.get(photo['url']).status_code==200
        draft=c.get(f'/api/products/{product["id"]}/draft').json()
        assert 'Bs 40.00' in draft['facebook_description']
        assert '22' not in draft['facebook_description']
        assert c.post('/api/jobs',json={'product_id':product['id'],'mode':'ia','count':2},headers=headers).status_code==422
        sale={'client':'Compradora','payment_method':'QR','paid_amount':50,'transport_cost':4,
              'other_expenses':2,'extra_income':10,'items':[{'product_id':product['id'],'quantity':1}]}
        s=c.post('/api/sales',json=sale,headers=headers)
        assert s.status_code==201,s.text
        assert s.json()['profit']==22.0  # 40 + 10 - 22 - 4 - 2
        assert c.get('/api/products').json()[0]['stock']==4
        # Registrar abono posterior sin duplicar ingresos
        partial=c.post('/api/sales',json={**sale,'paid_amount':10},headers=headers)
        assert partial.status_code==201, partial.text
        v=partial.json()
        assert v['balance']==40
        payment=c.post(f'/api/sales/{v["id"]}/payments',json={'amount':40,'method':'Efectivo'},headers=headers)
        assert payment.status_code==200,payment.text
        assert payment.json()['balance']==0
        assert c.get('/api/dashboard').json()['sales_total']==100
        assert c.post('/api/sales',json={**sale,'items':[{'product_id':product['id'],'quantity':10}]},headers=headers).status_code==409
        # Segundo admin: datos compartidos e historial persistente
        with TestClient(app) as c2:
            r2=c2.post('/api/login',json={'username':'admin2','password':'LongPasswordTest2!'})
            assert r2.status_code==200
            assert len(c2.get('/api/products').json())==1
            assert c2.get('/api/dashboard').json()['sales_total']==100
            assert c2.get(photo['url']).status_code==200
        job=c.post('/api/jobs',json={'product_id':product['id'],'mode':'plantillas','count':2},headers=headers)
        assert job.status_code==201,job.text
        deadline=time.time()+22
        while time.time()<deadline:
            entry=next(x for x in c.get('/api/jobs').json() if x['id']==job.json()['id'])
            if entry['status'] in ('done','failed'):break
            time.sleep(.3)
        assert entry['status']=='done', entry
        assert entry['completed']==2
        assert len(c.get(f'/api/jobs/{job.json()["id"]}/images').json())==2
        assert c.get(f'/api/jobs/{job.json()["id"]}/download').status_code==200
        image_ids=[x['id'] for x in c.get(f'/api/jobs/{job.json()["id"]}/images').json()]
        photo_bytes=[c.get(f'/api/generated/{n}/download').content for n in image_ids]
        assert all(x.startswith(b'\\xff\\xd8') for x in photo_bytes)
        assert hashlib.sha256(photo_bytes[0]).digest()!=hashlib.sha256(photo_bytes[1]).digest()
        assert c.delete(f'/api/jobs/{job.json()["id"]}').status_code==403
        deleted=c.delete(f'/api/jobs/{job.json()["id"]}',headers=headers)
        assert deleted.status_code==200 and deleted.json()['deleted']==2
        assert c.get(f'/api/jobs/{job.json()["id"]}/images').status_code==404
        assert c.get(f'/api/generated/{image_ids[0]}/download').status_code==404
        assert c.get(photo['url']).status_code==200
        assert c.post(f'/api/sales/{s.json()["id"]}/cancel',headers=headers).status_code==200
        assert c.get('/api/products').json()[0]['stock']==4
        assert c.post('/api/logout',headers=headers).status_code==200
        assert c.get(photo['url']).status_code==401
