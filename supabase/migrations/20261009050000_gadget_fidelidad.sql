-- Gadget Tarjeta de fidelidad: puntos por visita, canje y pase de wallet.
-- La wallet no firma pases hasta que existan las claves del emisor.

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS gadget_fidelidad boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fidelidad_puntos integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS fidelidad_meta integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS fidelidad_premio text NOT NULL DEFAULT 'Un premio';

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_fidelidad_puntos_ok;
ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_fidelidad_puntos_ok
  CHECK (fidelidad_puntos BETWEEN 1 AND 500);

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_fidelidad_meta_ok;
ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_fidelidad_meta_ok
  CHECK (fidelidad_meta BETWEEN 1 AND 5000);

COMMENT ON COLUMN public.restaurantes.gadget_fidelidad IS
  'Gadget de tarjeta de fidelidad en la carta pública y el escáner del local.';
COMMENT ON COLUMN public.restaurantes.fidelidad_puntos IS
  'Puntos que suma cada visita escaneada.';
COMMENT ON COLUMN public.restaurantes.fidelidad_meta IS
  'Puntos que se descuentan al canjear el premio.';
COMMENT ON COLUMN public.restaurantes.fidelidad_premio IS
  'Nombre del premio que ve el cliente.';

CREATE TABLE IF NOT EXISTS public.fidelidad_tarjetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nombre text NOT NULL DEFAULT '',
  telefono text NOT NULL,
  puntos integer NOT NULL DEFAULT 0 CHECK (puntos >= 0 AND puntos <= 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fidelidad_tarjetas_codigo_ok CHECK (codigo ~ '^[A-Z2-9]{8}$'),
  CONSTRAINT fidelidad_tarjetas_telefono_ok CHECK (char_length(telefono) BETWEEN 8 AND 15),
  CONSTRAINT fidelidad_tarjetas_codigo_unico UNIQUE (restaurante_id, codigo),
  CONSTRAINT fidelidad_tarjetas_telefono_unico UNIQUE (restaurante_id, telefono)
);

CREATE INDEX IF NOT EXISTS fidelidad_tarjetas_restaurante_idx
  ON public.fidelidad_tarjetas (restaurante_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fidelidad_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarjeta_id uuid NOT NULL REFERENCES public.fidelidad_tarjetas (id) ON DELETE CASCADE,
  restaurante_id uuid NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0 AND delta BETWEEN -5000 AND 500),
  motivo text NOT NULL CHECK (motivo IN ('visita', 'canje')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fidelidad_movimientos_tarjeta_idx
  ON public.fidelidad_movimientos (tarjeta_id, created_at DESC);

ALTER TABLE public.fidelidad_tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidad_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fidelidad_tarjetas_select_gestor ON public.fidelidad_tarjetas;
CREATE POLICY fidelidad_tarjetas_select_gestor ON public.fidelidad_tarjetas
  FOR SELECT TO authenticated
  USING (private.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS fidelidad_movimientos_select_gestor ON public.fidelidad_movimientos;
CREATE POLICY fidelidad_movimientos_select_gestor ON public.fidelidad_movimientos
  FOR SELECT TO authenticated
  USING (private.can_manage_restaurante(restaurante_id));

REVOKE ALL ON TABLE public.fidelidad_tarjetas FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.fidelidad_movimientos FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.fidelidad_tarjetas TO authenticated;
GRANT SELECT ON TABLE public.fidelidad_movimientos TO authenticated;
GRANT ALL ON TABLE public.fidelidad_tarjetas TO service_role;
GRANT ALL ON TABLE public.fidelidad_movimientos TO service_role;
