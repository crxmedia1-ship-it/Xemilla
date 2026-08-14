-- Xemilla: gadget nutrición + campos platos
-- Ejecutar en Supabase SQL editor si aún no están en el schema principal.

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS gadget_nutricion BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.restaurantes.gadget_nutricion IS
  'Activa ficha nutricional, macros y filtros de alérgenos (admin + WebApp).';

ALTER TABLE public.platos
  ADD COLUMN IF NOT EXISTS calorias INTEGER,
  ADD COLUMN IF NOT EXISTS proteinas INTEGER,
  ADD COLUMN IF NOT EXISTS carbs INTEGER,
  ADD COLUMN IF NOT EXISTS grasas INTEGER,
  ADD COLUMN IF NOT EXISTS alergias TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ingredientes_detalle TEXT;
