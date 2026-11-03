-- Registro de auditoría y advertencias para el catálogo del proveedor
-- Aplicado al proyecto Supabase el 2026-11-03. No modifica el stock de las tiendas.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_review_note VARCHAR(400) NULL;
ALTER TABLE public.supplier_catalog_updates ADD COLUMN IF NOT EXISTS admin_id INTEGER NULL
    REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_catalog_updates ALTER COLUMN new_supplier_stock DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_updates_product_time
    ON public.supplier_catalog_updates (product_id, recorded_at DESC);
ALTER TABLE public.supplier_catalog_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.supplier_catalog_updates FROM PUBLIC, anon, authenticated;

-- Historial antiguo de capturas se mantiene tal como estaba.
-- Un registro con new_supplier_stock NULL significa cantidad por confirmar.
