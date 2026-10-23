from io import BytesIO
from types import SimpleNamespace
from decimal import Decimal
from PIL import Image
from app.wholesale_poster import create_wholesale_poster


def test_poster_generates_two_distinct_jpgs_without_exposing_costs(tmp_path):
    source = tmp_path / 'original.jpg'
    Image.new('RGB', (500, 550), 'white').save(source)
    item = SimpleNamespace(name='Producto de prueba', sku='MAY-000004')
    wholesale = SimpleNamespace(
        min_wholesale_qty=3, wholesale_unit_price=Decimal('42'),
        units_per_pack=12, pack_total_price=Decimal('480'),
        units_per_carton=100, carton_total_price=Decimal('3700'),
        colors='Rojo, amarillo, plomo')
    a = create_wholesale_poster(source, item, wholesale, 'premium')
    b = create_wholesale_poster(source, item, wholesale, 'oferta')
    assert a.startswith(b'\xff\xd8') and b.startswith(b'\xff\xd8')
    assert a != b
    assert Image.open(BytesIO(a)).size == (1080, 1350)
    assert Image.open(BytesIO(b)).size == (1080, 1350)
