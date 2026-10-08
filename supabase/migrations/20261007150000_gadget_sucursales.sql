-- Gadget de pago "Sucursales": se activa desde Identidad (SuperAdmin) con un cupo
-- de sedes contratadas (incluye la principal). Apagado = solo existe la principal.
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS gadget_sucursales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sucursales_cupo smallint NOT NULL DEFAULT 1;

DO $$
BEGIN
  ALTER TABLE public.restaurantes
    ADD CONSTRAINT restaurantes_sucursales_cupo_rango CHECK (sucursales_cupo BETWEEN 1 AND 50);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
