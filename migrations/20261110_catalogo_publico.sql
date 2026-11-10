-- Catálogo público de Mega Compra, separado del inventario privado.
-- Esta migración se aplicó previamente mediante Supabase a public.catalog_entries.
-- Ningún producto se publica por defecto.
CREATE TABLE IF NOT EXISTS public.catalog_entries (
 product_id INTEGER PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 published BOOLEAN NOT NULL DEFAULT FALSE,
 available BOOLEAN NOT NULL DEFAULT TRUE,
 available_units INTEGER NULL CHECK (available_units IS NULL OR available_units >= 0),
 price_unit NUMERIC(12,2) NULL CHECK (price_unit IS NULL OR price_unit > 0),
 price_three NUMERIC(12,2) NULL CHECK (price_three IS NULL OR price_three > 0),
 price_dozen NUMERIC(12,2) NULL CHECK (price_dozen IS NULL OR price_dozen > 0),
 price_case NUMERIC(12,2) NULL CHECK (price_case IS NULL OR price_case > 0),
 case_units INTEGER NULL CHECK (case_units IS NULL OR case_units >= 2),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT catalog_case_pair CHECK (
  (price_case IS NULL AND case_units IS NULL) OR
  (price_case IS NOT NULL AND case_units IS NOT NULL)
 ),
 CONSTRAINT catalog_published_has_price CHECK(published=FALSE OR price_unit IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS catalog_published_idx
 ON public.catalog_entries(published,available) WHERE published=TRUE;
ALTER TABLE public.catalog_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.catalog_entries FROM PUBLIC,anon,authenticated;
-- La consulta pública la hace únicamente FastAPI, seleccionando campos permitidos.
