ALTER TABLE public.restaurantes ADD COLUMN IF NOT EXISTS descuento_divisa NUMERIC(5,2) NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.restaurantes.descuento_divisa IS '% de descuento aplicado al pagar en divisas (USD/EUR) en caja. Rango 0-100.';
