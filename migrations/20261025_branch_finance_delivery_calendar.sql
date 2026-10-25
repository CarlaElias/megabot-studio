-- Agenda enriquecida compatible con entregas existentes, sin modificar su estado, fecha ni cliente.
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS product_summary VARCHAR(240) NOT NULL DEFAULT '';
-- Evitar acceso directo desde clientes públicos: solo el backend administra entregas.
REVOKE ALL PRIVILEGES ON public.deliveries FROM anon,authenticated;
