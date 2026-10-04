-- Plantilla de estructura para sección Nosotros (WebApp)
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS nosotros_theme text NOT NULL DEFAULT 'editorial';

COMMENT ON COLUMN public.restaurantes.nosotros_theme IS
  'Layout theme for Nosotros section: editorial | split | bento';

-- Clamp valores inválidos a editorial
UPDATE public.restaurantes
SET nosotros_theme = 'editorial'
WHERE nosotros_theme IS NULL
   OR lower(trim(nosotros_theme)) NOT IN ('editorial', 'split', 'bento');
