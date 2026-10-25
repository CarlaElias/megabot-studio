"""Sucursal La Paz: traslado seguro, venta por local, anulación, Excel."""
from tests.test_smoke import F  # reutilizar misma base de datos SQLite temporal (solo pruebas)
from fastapi.testclient import TestClient
from app.main import app

def test_branch_lapaz_transfers_sales_and_cancel():
    from app.models import init_db
    init_db()
    with TestClient(app) as c:
        login=c.post('/api/login', json={'username':'admin1','password':'LongPasswordTest1!'})
        assert login.status_code==200,login.text
        headers={'X-CSRF-Token':login.json()['csrf']}
        r=c.post('/api/products', json={'name':'Aro LED transferencia','category':'Electrónicos','stock':20,'sale_price':70,'purchase_cost':40},headers=headers)
        assert r.status_code==201,r.text
        pid=r.json()['id']
        all_items=c.get('/api/products').json()
        assert [p['id'] for p in all_items] == sorted(p['id'] for p in all_items)
        transfer=c.post('/api/branches/lapaz/transfer',json={'product_id':pid,'quantity':7,'source_location':'tienda'},headers=headers)
        assert transfer.status_code==201,transfer.text
        assert transfer.json()['tienda_stock']==13 and transfer.json()['lapaz_stock']==7
        assert c.get('/api/branches/lapaz').json()['stocks'][str(pid)]==7
        assert c.post('/api/branches/lapaz/transfer',json={'product_id':pid,'quantity':14,'source_location':'tienda'},headers=headers).status_code==409
        assert c.post('/api/branches/lapaz/transfer',json={'product_id':pid,'quantity':1,'source_location':'lapaz'}).status_code==403
        sale={'client':'Cliente sucursal','payment_method':'Efectivo','paid_amount':210,'transport_cost':0,'other_expenses':0,'extra_income':0,'items':[{'product_id':pid,'quantity':3}],'location':'lapaz'}
        resp=c.post('/api/sales',json=sale,headers=headers)
        assert resp.status_code==201,resp.text
        assert resp.json()['location']=='lapaz'
        assert next(p for p in c.get('/api/products').json() if p['id']==pid)['stock']==13
        assert c.get('/api/branches/lapaz').json()['stocks'][str(pid)]==4
        assert c.post('/api/sales',json={**sale,'items':[{'product_id':pid,'quantity':5}],'paid_amount':0},headers=headers).status_code==409
        cancelled=c.post(f'/api/sales/{resp.json()["id"]}/cancel',headers=headers)
        assert cancelled.status_code==200,cancelled.text
        assert c.get('/api/branches/lapaz').json()['stocks'][str(pid)]==7
        back=c.post('/api/branches/lapaz/transfer',json={'product_id':pid,'quantity':2,'source_location':'lapaz'},headers=headers)
        assert back.status_code==201 and back.json()['tienda_stock']==15 and back.json()['lapaz_stock']==5
        excel=c.get('/api/products/excel')
        assert excel.status_code==200
        import zipfile,io
        with zipfile.ZipFile(io.BytesIO(excel.content)) as z:
            content=z.read('xl/worksheets/sheet1.xml').decode()
            assert 'Tienda stock' in content and 'La Paz stock' in content and 'Stock total' in content
        assert len(c.get('/api/branches/lapaz').json()['transfers'])>=2
