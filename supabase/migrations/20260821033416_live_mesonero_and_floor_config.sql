ALTER TABLE public.sesiones_mesa ADD COLUMN IF NOT EXISTS mesonero_nombre TEXT NOT NULL DEFAULT '';
ALTER TABLE public.restaurantes ADD COLUMN IF NOT EXISTS mesas_config JSONB NOT NULL DEFAULT '{}';
