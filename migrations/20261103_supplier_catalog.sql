-- MegaBot / Catálogo importadora, 2026-11-03
-- Conserva inventario, precios de venta y movimientos originales.
-- Aplicada ya al proyecto Supabase de MegaBot; se incluye para trazabilidad.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_unit_price NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS public.supplier_catalog_updates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  old_supplier_stock INTEGER NULL,
  new_supplier_stock INTEGER NOT NULL CHECK (new_supplier_stock >= 0),
  old_supplier_unit_price NUMERIC(12,2) NULL,
  new_supplier_unit_price NUMERIC(12,2) NULL CHECK (new_supplier_unit_price >= 0),
  source_label VARCHAR(160) NOT NULL DEFAULT 'Capturas de importadora',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_catalog_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.supplier_catalog_updates FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.supplier_catalog_updates_id_seq FROM PUBLIC, anon, authenticated;

-- supplier_stock / supplier_unit_price son datos declarados por el proveedor.
-- NO sustituyen el stock físico ni purchase_cost, que siguen siendo propios.
