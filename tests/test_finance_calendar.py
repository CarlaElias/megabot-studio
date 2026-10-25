"""Separation of finance by source and full lifecycle of delivery calendar."""
from tests.test_smoke import F
from fastapi.testclient import TestClient
from app.main import app
from app.models import init_db


def test_finance_by_location_and_delivery_lifecycle():
    init_db()
    with TestClient(app) as c:
        login = c.post('/api/login', json={'username': 'admin1', 'password': 'LongPasswordTest1!'})
        assert login.status_code == 200, login.text
        h = {'X-CSRF-Token': login.json()['csrf']}
        product = c.post('/api/products', headers=h, json={
            'name': 'Luces de prueba para contabilidad', 'category': 'Electrónicos',
            'stock': 10, 'sale_price': 100, 'purchase_cost': 60
        })
        assert product.status_code == 201, product.text
        product_id = product.json()['id']
        transfer = c.post('/api/branches/lapaz/transfer', headers=h, json={
            'product_id': product_id, 'source_location': 'tienda', 'quantity': 4
        })
        assert transfer.status_code == 201, transfer.text
        def dashboard():
            r = c.get('/api/dashboard')
            assert r.status_code == 200, r.text
            return r.json()
        d = dashboard()['branches']
        assert d['tienda']['investment'] >= 360
        assert d['lapaz']['investment'] >= 240
        assert d['lapaz']['stock'] >= 4
        sale = c.post('/api/sales', headers=h, json={
            'client': 'Cliente prueba sucursal', 'phone': '0000', 'payment_method': 'QR',
            'paid_amount': 100, 'transport_cost': 8, 'other_expenses': 2, 'extra_income': 0,
            'items': [{'product_id': product_id, 'quantity': 1}], 'location': 'lapaz'
        })
        assert sale.status_code == 201, sale.text
        d = dashboard()['branches']
        assert d['lapaz']['sales_total'] >= 100
        assert d['lapaz']['profit_total'] >= 30
        assert d['lapaz']['stock'] >= 3
        sale_id = sale.json()['id']
        assert c.post(f'/api/sales/{sale_id}/cancel', headers=h).status_code == 200
        d = dashboard()['branches']
        assert d['lapaz']['sales_total'] == 0
        assert d['lapaz']['profit_total'] == 0
        assert d['lapaz']['stock'] >= 4

        new = c.post('/api/deliveries', headers=h, json={
            'client': 'Luz Suárez', 'phone': '71234567', 'product_summary': 'Aro LED',
            'location': 'Correos - Estación Central', 'scheduled_at': '2026-10-30T17:45:00',
            'notes': 'Entregar en mostrador'
        })
        assert new.status_code == 201, new.text
        delivery_id = new.json()['id']
        row = next(x for x in c.get('/api/deliveries').json() if x['id'] == delivery_id)
        assert row['phone'] == '71234567' and row['product_summary'] == 'Aro LED'
        edited = c.put(f'/api/deliveries/{delivery_id}', headers=h, json={
            'client': 'Luz Suárez', 'phone': '71234567', 'product_summary': 'Aro LED 12 pulgadas',
            'location': 'Entrega a domicilio', 'scheduled_at': '2026-11-01T14:30:00',
            'notes': 'Cambiar dirección'
        })
        assert edited.status_code == 200, edited.text
        assert c.patch(f'/api/deliveries/{delivery_id}/status',headers=h,json={'status':'Entregado'}).status_code == 200
        row = next(x for x in c.get('/api/deliveries').json() if x['id'] == delivery_id)
        assert row['product_summary'] == 'Aro LED 12 pulgadas'
        assert row['scheduled_at'].startswith('2026-11-01')
        assert row['status'] == 'Entregado'
