"""Mayoristas: afiche JPG gratis y sin persistencia, copia intacta de la foto original."""
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps


def _font(size, bold=False):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _crop_text(draw, text, font, limit):
    original = ' '.join(str(text).split())
    text = original
    while text and draw.textbbox((0, 0), text, font=font)[2] > limit:
        text = text[:-1]
    return text.rstrip() + '…' if text != original else text


def create_wholesale_poster(original_path: Path, product, profile, style='premium'):
    """Solo la información pública; jamás costo, proveedor o ganancia privada."""
    W, H = 1080, 1350
    premium = style == 'premium'
    bg = (14, 23, 38) if premium else (252, 246, 237)
    fg = (255, 250, 239) if premium else (26, 31, 44)
    accent = (255, 204, 105) if premium else (205, 44, 78)
    card_fg = bg if premium else (255, 255, 255)
    board = Image.new('RGB', (W, H), bg)
    draw = ImageDraw.Draw(board)
    draw.text((70, 39), 'MEGA COMPRA', font=_font(54, True), fill=accent)
    draw.text((73, 110), 'PRECIOS POR MAYOR · BOLIVIA', font=_font(24, True), fill=fg)
    draw.rounded_rectangle((45, 157, 1035, 770), radius=42,
                           fill=(245, 245, 243) if premium else (255, 255, 255))
    with Image.open(original_path) as src:
        photo = ImageOps.exif_transpose(src).convert('RGB')
        photo.thumbnail((920, 570), Image.Resampling.LANCZOS)
    board.paste(photo, ((W-photo.width)//2, 177+(570-photo.height)//2))
    draw.text((73, 800), _crop_text(draw, product.name.upper(), _font(54, True), 935),
              font=_font(54, True), fill=fg)
    draw.text((75, 868), f'CÓDIGO: {product.sku}', font=_font(26, True), fill=accent)
    draw.text((75, 908), f'DESDE {profile.min_wholesale_qty} UNIDADES', font=_font(27), fill=fg)
    draw.rounded_rectangle((62, 963, 1018, 1102), radius=24, fill=accent)
    draw.text((89, 981), 'PRECIO MAYORISTA POR UNIDAD', font=_font(24, True), fill=card_fg)
    draw.text((88, 1019), f'Bs {profile.wholesale_unit_price:.2f}', font=_font(52, True), fill=card_fg)
    draw.text((76, 1125), f'EMBALAJE ({profile.units_per_pack} ud.): Bs {profile.pack_total_price:.2f}',
              font=_font(28, True), fill=fg)
    draw.text((76, 1177), f'CAJÓN ({profile.units_per_carton} ud.): Bs {profile.carton_total_price:.2f}',
              font=_font(28, True), fill=fg)
    colors = 'COLORES: ' + (profile.colors or 'Consulta disponibilidad')
    draw.text((76, 1236), _crop_text(draw, colors, _font(25), 910), font=_font(25), fill=accent)
    draw.text((76, 1300), 'CONSULTAS Y PEDIDOS POR MENSAJE', font=_font(22), fill=fg)
    out = BytesIO()
    board.save(out, format='JPEG', quality=91, optimize=True)
    return out.getvalue()
