"""Diseños locales verificables y edición opcional de imágenes con una API de IA."""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import math, os, random, base64

# 15 tech, 10 catálogo, 10 ambientes, 10 promociones, 5 especiales.
PALETTES = [
 ('#071827','#00D5FF','tech'),('#120B32','#9A5BFF','tech'),('#092320','#00E5A8','tech'),('#2B0926','#FF4D8D','tech'),('#0B154A','#376BFF','tech'),('#2A140B','#FF7A00','tech'),('#102009','#BBF742','tech'),('#10242F','#20B8DB','tech'),('#200E35','#C370F6','tech'),('#300B1A','#F43F5E','tech'),('#0B2C2A','#14B8A6','tech'),('#2F280E','#FACC15','tech'),('#18154C','#8884FF','tech'),('#2D1226','#FF6D98','tech'),('#0C243C','#38BDF8','tech'),
 ('#E8F1FA','#FFFFFF','catalogo'),('#E4E7EB','#FAFAFA','catalogo'),('#222938','#F1F4F7','catalogo'),('#E9DACB','#FFF7EF','catalogo'),('#C3DBF5','#F1F8FF','catalogo'),('#C4E8D9','#EEFFF6','catalogo'),('#F8D8E7','#FFF3FA','catalogo'),('#DDD3F9','#F7F2FF','catalogo'),('#FAE8BD','#FFFAEE','catalogo'),('#BCCCDD','#F2F6FA','catalogo'),
 ('#C7A98D','#F0E3D2','ambiente'),('#A2B9AA','#E8EFE4','ambiente'),('#C4A695','#F8E1D2','ambiente'),('#7692B1','#DCEBF8','ambiente'),('#D6C2A2','#F9EDDA','ambiente'),('#99B19A','#E4F0D8','ambiente'),('#D6C3AD','#FEF6E8','ambiente'),('#978576','#DDCEBD','ambiente'),('#9FB7D1','#F1F6FB','ambiente'),('#BEAFE0','#F3EFFB','ambiente'),
 ('#4D0610','#FF4C63','promo'),('#4B2500','#FFB625','promo'),('#07321B','#47D88D','promo'),('#0B2851','#57A6FF','promo'),('#310C51','#BB70FF','promo'),('#4C1037','#FF75C1','promo'),('#073E45','#6FEAFA','promo'),('#59210A','#FF985C','promo'),('#2B4110','#BEF05F','promo'),('#524000','#FFE169','promo'),
 ('#111827','#D5AF52','especial'),('#26071B','#FC3582','especial'),('#07152F','#4EA4FF','especial'),('#201240','#AC81FF','especial'),('#1D1D1D','#E5E5E5','especial')
]


def rgb(h):
    return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))

FONT_FAMILIES = (
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans', 'C:/Windows/Fonts/arial'),
    ('/usr/share/fonts/truetype/lato/Lato', 'C:/Windows/Fonts/calibri'),
    ('/usr/share/fonts/truetype/liberation2/LiberationSans', 'C:/Windows/Fonts/arial'),
)

def font(size=32, bold=False, family=0):
    linux, windows = FONT_FAMILIES[family % len(FONT_FAMILIES)]
    names = []
    if 'Lato' in linux:
        names += [linux + ('-Black.ttf' if bold else '-Regular.ttf')]
    elif 'DejaVuSans' in linux:
        names += [linux + ('-Bold.ttf' if bold else '.ttf')]
    else:
        names += [linux + ('-Bold.ttf' if bold else '-Regular.ttf')]
    names += [windows + ('bd.ttf' if bold else '.ttf'),
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()

def fitted_font(draw, text, max_width, size=50, min_size=22, family=0):
    for n in range(size, min_size-1, -2):
        f = font(n, True, family)
        if draw.textbbox((0,0), text, font=f)[2] <= max_width:
            return f
    return font(min_size, True, family)

def gradient(colors, index, size=(1024,1024)):
    top, bottom = colors
    surface = Image.new('RGB', size)
    d = ImageDraw.Draw(surface)
    for y in range(size[1]):
        t = min(1., max(0., (y / max(1, size[1]-1)) ** (1.05 if index % 2 else .72)))
        c = tuple(round(a * (1-t) + b * t) for a,b in zip(top,bottom))
        d.line((0, y, size[0], y), fill=c)
    return surface

def contrast(color):
    r,g,b = color
    return (18,21,33) if (.2126*r+.7152*g+.0722*b)>145 else (255,255,255)

def rounded(draw, box, fill, radius=26, outline=None, width=1):
    draw.rounded_rectangle(tuple(map(int,box)), radius=radius, fill=fill, outline=outline, width=width)

def photo_card(canvas, image_path, bounds, radius=28, border='#FFFFFF', shadow=True):
    """Fit the unmodified original photo inside a card; never invent product details."""
    x0,y0,x1,y1 = map(int, bounds)
    pad=12
    if shadow:
        glow = Image.new('RGBA', canvas.size, (0,0,0,0))
        ImageDraw.Draw(glow).rounded_rectangle((x0+9,y0+18,x1+9,y1+18),radius=radius,fill=(0,0,0,94))
        canvas.paste(Image.alpha_composite(canvas.convert('RGBA'), glow.filter(ImageFilter.GaussianBlur(21))).convert('RGB'))
    d=ImageDraw.Draw(canvas)
    rounded(d,(x0,y0,x1,y1), '#FFFFFF',radius=radius,outline=border,width=3)
    with Image.open(image_path) as raw:
        photo=ImageOps.exif_transpose(raw).convert('RGB')
        photo.thumbnail((x1-x0-pad*2,y1-y0-pad*2),Image.Resampling.LANCZOS)
        x=round(x0+(x1-x0-photo.width)/2)
        y=round(y0+(y1-y0-photo.height)/2)
        canvas.paste(photo,(x,y))
    return (x0,y0,x1,y1)

def draw_brand(canvas, logo_path, x=34,y=31, width=135, height=96, dark=True):
    path=Path(logo_path) if logo_path else Path(__file__).resolve().parent/'static'/'megacompra-logo.webp'
    if path.exists():
        with Image.open(path) as raw:
            image=raw.convert('RGBA')
            image.thumbnail((width,height), Image.Resampling.LANCZOS)
            # Preserve the exact brand mark, including internal labels.
            base=Image.new('RGBA', (width,height), (0,0,0,0))
            base.alpha_composite(image,((width-image.width)//2,(height-image.height)//2))
            if canvas.mode!='RGBA':
                canvas.paste(base,(x,y),base)
            else:
                canvas.alpha_composite(base,(x,y))
    else:
        d=ImageDraw.Draw(canvas)
        d.text((x,y+20),'MEGA COMPRA',font=font(26,True),fill='white' if dark else '#101019')

def label(draw, text, x, y, fill, width, size=53, family=0):
    value=' '.join(str(text).split())[:180]
    face=fitted_font(draw,value,width,size=size,min_size=25,family=family)
    while value and draw.textbbox((0,0),value,font=face)[2]>width:
        value=value[:-2]
    if value!=str(text).strip() and len(value)>3:
        value=value.rstrip()+'…'
    draw.text((x,y),value,font=face,fill=fill,stroke_width=0)

def add_footer(canvas,title,price,color_bg,color_text,accent,style=0,phone=''):
    d=ImageDraw.Draw(canvas)
    dark_bg=tuple(int(x) for x in color_bg)
    if style in (2,4,7):
        rounded(d,(38,824,988,998),(*dark_bg,),radius=30)
        x=65;title_y=845;price_y=917
        title_color=tuple(color_text)
    else:
        x=56;title_y=830;price_y=909
        title_color=tuple(color_text)
    label(d,title,x,title_y,title_color,890,49,style)
    d.text((x,price_y),f'Bs {price:,.2f}',font=font(64,True,style),fill=tuple(accent) if style in (2,4,7) else title_color)
    if phone:
        text='WhatsApp '+phone
        f=font(21,True,style)
        xx=986-d.textbbox((0,0),text,font=f)[2]
        d.text((xx,961),text,font=f,fill=title_color)

def compose_photo(image_path,out_path,title,price,index,logo_path=None):
    """Create 50 editorial variations from REAL product photos: no product synthesis, free."""
    bg_hex,accent_hex,group=PALETTES[index%50]
    bg=rgb(bg_hex);accent=rgb(accent_hex)
    typ=index%12
    light=group in {'catalogo','ambiente'}
    if light:
        top,bottom=bg,(249,248,244) if typ%2 else rgb(accent_hex)
    else:
        top,bottom=bg,tuple(round(v*.55) for v in bg)
    canvas=gradient((top,bottom),index)
    d=ImageDraw.Draw(canvas,'RGBA')
    rng=random.Random(index*73+9871)
    # Distinct structural compositions rather than a simple background swap.
    if typ==0:  # gallery spotlight
        d.ellipse((-200,45,850,1070), fill=(*accent,42))
        photo_card(canvas,image_path,(125,162,905,779),radius=46,border=accent_hex)
    elif typ==1:  # angular / diagonal banner
        d.polygon([(0,185),(1024,65),(1024,270),(0,490)],fill=(*accent,55))
        photo_card(canvas,image_path,(64,195,960,774),radius=30,border=accent_hex)
    elif typ==2:  # framed inset
        d.rounded_rectangle((36,153,988,803),radius=58,outline=(*accent,245),width=9)
        photo_card(canvas,image_path,(82,200,940,772),radius=18)
    elif typ==3:  # left aligned visual, right accent spine
        d.rounded_rectangle((918,145,1010,810),radius=45,fill=(*accent,135))
        photo_card(canvas,image_path,(46,176,900,794),radius=50)
    elif typ==4:  # futuristic grid
        for x in range(0,1024,70):d.line((x,138,x,800),fill=(*accent,30),width=1)
        for y in range(135,810,70):d.line((0,y,1024,y),fill=(*accent,30),width=1)
        photo_card(canvas,image_path,(145,174,880,774),radius=22,border=accent_hex)
    elif typ==5:  # offset poster
        d.rectangle((0,135,1024,803),fill=(*accent,72))
        photo_card(canvas,image_path,(95,177,935,772),radius=50)
    elif typ==6:  # circular rings
        for k in range(5):d.ellipse((140-35*k,200-35*k,910+35*k,750+35*k),outline=(*accent,max(15,70-10*k)),width=8)
        photo_card(canvas,image_path,(123,185,900,768),radius=45)
    elif typ==7:  # strong product catalogue
        d.rounded_rectangle((0,167,1024,796),radius=0,fill=(255,255,255,45))
        photo_card(canvas,image_path,(90,192,931,760),radius=10,border=accent_hex)
    elif typ==8:  # gallery stripes
        for k in range(8):
            x=k*150-230
            d.polygon([(x,135),(x+90,135),(x+410,802),(x+320,802)],fill=(*accent,25))
        photo_card(canvas,image_path,(78,210,946,770),radius=36)
    elif typ==9:  # clean editorial card
        d.rounded_rectangle((36,142,985,803),radius=32,fill=(255,255,255,34) if not light else (255,255,255,75))
        photo_card(canvas,image_path,(75,182,949,766),radius=45)
    elif typ==10:  # offset lines
        for k in range(7):d.rounded_rectangle((52+k*13,158+k*11,967-k*13,804-k*11),radius=45,outline=(*accent,22),width=3)
        photo_card(canvas,image_path,(157,207,864,761),radius=36)
    else:  # photographic magazine
        d.ellipse((490,-120,1300,680),fill=(*accent,45))
        d.ellipse((-320,410,450,1080),fill=(*accent,35))
        photo_card(canvas,image_path,(58,206,950,774),radius=18)
    d=ImageDraw.Draw(canvas,'RGBA')
    dark_ink=(18,22,33);light_ink=(255,255,255)
    # Branding panel, exact artwork and legible typography.
    rounded(d,(22,14,729,137),(17,19,30,234),radius=26)
    draw_brand(canvas,logo_path,26,20,138,112)
    d=ImageDraw.Draw(canvas)
    d.text((171,50),'MEGA COMPRA',font=font(42,True,typ),fill='white')
    d.text((174,101),'PUBLICIDAD ORIGINAL · PRODUCTO REAL',font=font(15,False,typ),fill='#F6CF8A')
    badge_bg=accent if contrast(accent)==dark_ink else (247,229,174)
    rounded(d,(829,29,992,105),badge_bg,radius=23)
    d.text((865,49),f'{index+1:02d}/50',font=font(31,True,typ),fill=contrast(badge_bg))
    footer_dark=(16,20,33)
    footer_ink=(255,255,255) if not light or typ in (2,4,7) else (20,27,39)
    if not light or typ in (2,4,7):
        rounded(d,(26,815,1000,1009),footer_dark,radius=28)
    elif light:
        rounded(d,(26,815,1000,1009),(255,255,255),radius=28)
    label(d,title,55,836,footer_ink,930,47,typ)
    d.text((56,912),f'Bs {float(price):,.2f}',font=font(61,True,typ),fill=accent if not light else dark_ink)
    phone=os.getenv('CONTACT_WHATSAPP','').strip()
    if phone:
        text='WhatsApp '+phone[:24]
        d.text((995-d.textbbox((0,0),text,font=font(22,True,typ))[2],962),text,font=font(22,True,typ),fill=footer_ink)
    out_path=Path(out_path)
    out_path.parent.mkdir(parents=True,exist_ok=True)
    canvas.save(out_path,format='JPEG',quality=92,optimize=True,subsampling=0)


def ai_photo(reference,out_path,title,description,price,index,model,api_key):
    """Optional paid service: AI may alter product reference, so require manual approval."""
    from openai import OpenAI
    color1,color2,group=PALETTES[index%50]
    prompt=(f'Create an e-commerce product photograph with empty space for later pricing overlays. '
            f'The attached image is the product reference. Do not change its color, geometry or accessories, '
            f'and do not invent any claims, labels, brand names or text. '
            f'Product: {title[:150]}. Verified details: {description[:700]}. '
            f'Art direction: {group}, palette {color1} and {color2}, look {index+1}. No text.')
    client=OpenAI(api_key=api_key,timeout=180,max_retries=1)
    with open(reference,'rb') as image:
        res=client.images.edit(model=model,image=image,prompt=prompt,size='1024x1024',quality='medium')
    data=res.data[0].b64_json
    if not data:raise RuntimeError('La IA no devolvió ninguna imagen.')
    with Image.open(BytesIO(base64.b64decode(data))) as generated:
        # Any product alteration by AI is a known risk. This output requires approval.
        pic=generated.convert('RGB')
    d=ImageDraw.Draw(pic)
    rounded(d,(20,17,722,138),(12,17,29),radius=22)
    draw_brand(pic,None,23,25,130,106)
    d=ImageDraw.Draw(pic)
    d.text((164,50),'MEGA COMPRA',font=font(40,True,index),fill='white')
    rounded(d,(22,815,1001,1003),(13,16,26),radius=26)
    label(d,title,57,836,(255,255,255),901,44,index)
    d.text((58,916),f'Bs {float(price):,.2f}',font=font(58,True,index),fill=rgb(PALETTES[index%50][1]))
    pic.save(out_path,quality=90)
