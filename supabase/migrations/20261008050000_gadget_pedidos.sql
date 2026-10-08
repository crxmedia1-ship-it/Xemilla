-- Gadget de pago "Pedidos": carrito en la carta pública que envía el pedido al
-- WhatsApp de la sede. Se activa desde Identidad (SuperAdmin).
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS gadget_pedidos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS config_pedidos jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurantes.config_pedidos IS
  'JSON: { "modos": { "mesa", "delivery", "pickup" }, "cedula": "no|opcional|obligatoria", "nota": text, "metodos_pago": [{ "id", "tipo", "nombre", "datos" }] }.';

-- Grupos de opciones por plato (tamaño, extras, combos…).
ALTER TABLE public.platos
  ADD COLUMN IF NOT EXISTS opciones jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.platos
    ADD CONSTRAINT platos_opciones_es_array CHECK (jsonb_typeof(opciones) = 'array');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.platos.opciones IS
  'JSON: [{ "id", "nombre", "requerido", "max", "opciones": [{ "id", "nombre", "precio" }] }]. precio = recargo USD.';

-- Pedidos enviados desde la carta. Solo el servidor (service role) inserta,
-- tras recalcular precios contra la BD; los gestores leen y cambian el estado.
CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  restaurante_id uuid NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  sucursal_id uuid REFERENCES public.sucursales (id) ON DELETE SET NULL,
  modo text NOT NULL,
  mesa text,
  cliente jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_usd numeric(10, 2) NOT NULL CHECK (total_usd >= 0),
  tasa_bcv numeric(14, 4),
  total_bs numeric(16, 2),
  metodo_pago text,
  referencia_pago text,
  notas text,
  estado text NOT NULL DEFAULT 'nuevo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_modo_valido CHECK (modo IN ('mesa', 'delivery', 'pickup')),
  CONSTRAINT pedidos_estado_valido
    CHECK (estado IN ('nuevo', 'confirmado', 'listo', 'entregado', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS pedidos_restaurante_fecha_idx
  ON public.pedidos (restaurante_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pedidos_sucursal_idx ON public.pedidos (sucursal_id);

DROP TRIGGER IF EXISTS pedidos_touch ON public.pedidos;
CREATE TRIGGER pedidos_touch
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION private.sucursales_touch();

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_select_gestor ON public.pedidos;
CREATE POLICY pedidos_select_gestor ON public.pedidos
  FOR SELECT TO authenticated USING (private.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS pedidos_update_gestor ON public.pedidos;
CREATE POLICY pedidos_update_gestor ON public.pedidos
  FOR UPDATE TO authenticated
  USING (private.can_manage_restaurante(restaurante_id))
  WITH CHECK (private.can_manage_restaurante(restaurante_id));
