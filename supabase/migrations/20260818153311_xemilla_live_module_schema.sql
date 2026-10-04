-- Live module toggle on restaurants
ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS gadget_live_module BOOLEAN DEFAULT false;

-- Active table sessions
CREATE TABLE IF NOT EXISTS sesiones_mesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id TEXT NOT NULL,
  mesa_numero INTEGER NOT NULL,
  pin TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa',
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  CONSTRAINT sesiones_mesa_estado_check CHECK (estado IN ('activa', 'finalizada'))
);

CREATE INDEX IF NOT EXISTS sesiones_mesa_restaurante_estado ON sesiones_mesa(restaurante_id, estado);
CREATE INDEX IF NOT EXISTS sesiones_mesa_mesa ON sesiones_mesa(restaurante_id, mesa_numero, estado);

-- Live orders per session
CREATE TABLE IF NOT EXISTS pedidos_live (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID NOT NULL REFERENCES sesiones_mesa(id) ON DELETE CASCADE,
  restaurante_id TEXT NOT NULL,
  mesa_numero INTEGER NOT NULL,
  comensal_nombre TEXT NOT NULL,
  plato_id TEXT,
  plato_nombre TEXT NOT NULL,
  plato_precio NUMERIC DEFAULT 0,
  cantidad INTEGER NOT NULL DEFAULT 1,
  tipo TEXT NOT NULL DEFAULT 'plato',
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pedidos_live_tipo_check CHECK (tipo IN ('plato', 'mesero', 'cuenta')),
  CONSTRAINT pedidos_live_estado_check CHECK (estado IN ('pendiente', 'preparando', 'listo', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS pedidos_live_sesion ON pedidos_live(sesion_id);
CREATE INDEX IF NOT EXISTS pedidos_live_restaurante ON pedidos_live(restaurante_id, created_at DESC);

-- Enable Realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE sesiones_mesa;
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_live;
