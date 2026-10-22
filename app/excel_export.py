"""Exportación XLSX bajo demanda desde la base de datos (sin copias obsoletas en el servidor).

No escribe ni modifica hojas de cálculo del dispositivo del usuario.
"""
from datetime import datetime, timezone
from io import BytesIO
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
from decimal import Decimal


def colname(index):
    letters = ''
    while index:
        index, n = divmod(index - 1, 26)
        letters = chr(65 + n) + letters
    return letters


def xml_text(value):
    return escape(str(value or ''), {'"': '&quot;', "'": '&apos;'})


def cell(col, row, value, style=0):
    ref = f'{colname(col)}{row}'
    if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>{xml_text(value)}</t></is></c>'


def products_excel(products):
    """Genera XLSX actualizado al consultar, incluyendo archivados y márgenes."""
    output = BytesIO()
    headers = ['SKU', 'Producto', 'Categoría', 'Descripción', 'Precio venta (Bs)',
               'Costo compra (Bs)', 'Stock', 'Estado', 'Valor en stock (Bs)', 'Margen unitario (Bs)']
    table_rows = []
    for p in products:
        table_rows.append([p.sku, p.name, p.category, p.description,
                           p.sale_price, p.purchase_cost, p.stock,
                           'Activo' if p.active else 'Archivado',
                           Decimal(p.stock) * p.purchase_cost,
                           p.sale_price - p.purchase_cost])
    grid = []
    grid.append('<row r="1" ht="34" customHeight="1">' + cell(1, 1, 'MEGABOT INTEGRAL · INVENTARIO', 1) + '</row>')
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    grid.append('<row r="2">' + cell(1, 2, f'Generado: {timestamp} · Excel actual al momento de la descarga.', 3) + '</row>')
    grid.append('<row r="4" ht="26" customHeight="1">' + ''.join(cell(i, 4, h, 2) for i,h in enumerate(headers,1)) + '</row>')
    for row_index, values in enumerate(table_rows, 5):
        grid.append(f'<row r="{row_index}">' + ''.join(cell(i,row_index,value, 4 if i in (5,6,9,10) else 0) for i,value in enumerate(values,1)) + '</row>')
    last = max(5, 4 + len(table_rows))
    ws = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
          f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
          f'<cols><col min="1" max="1" width="17" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/>'
          f'<col min="3" max="3" width="20" customWidth="1"/><col min="4" max="4" width="46" customWidth="1"/>'
          f'<col min="5" max="10" width="19" customWidth="1"/></cols>'
          f'<sheetData>{"".join(grid)}</sheetData><autoFilter ref="A4:J{last}"/></worksheet>')
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;Bs&quot;"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="17"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF18243D"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''
    files = {
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Inventario" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': styles,
      'xl/worksheets/sheet1.xml': ws,
    }
    with ZipFile(output,'w',ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name,content)
    output.seek(0)
    return output
