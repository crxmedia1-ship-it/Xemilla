-- Xemilla: activar / desactivar locales (sin borrar)
-- Ejecutar en Supabase SQL editor si aún no está en el schema principal.

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.restaurantes.activo IS
  'Si FALSE, el local queda fuera de la WebApp pública (impago / pausa). SuperAdmin puede reactivar.';

CREATE INDEX IF NOT EXISTS idx_restaurantes_activo
  ON public.restaurantes (activo)
  WHERE activo = TRUE;
