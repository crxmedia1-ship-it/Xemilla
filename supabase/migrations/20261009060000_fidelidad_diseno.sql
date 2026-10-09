ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS fidelidad_diseno jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.restaurantes
    ADD CONSTRAINT restaurantes_fidelidad_diseno_objeto
    CHECK (jsonb_typeof(fidelidad_diseno) = 'object');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.restaurantes.fidelidad_diseno IS
  'Diseño de la tarjeta: fondo, tinta, acento y título.';
