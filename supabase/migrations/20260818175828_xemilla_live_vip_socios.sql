-- Session modality on restaurants (club vs commercial)
ALTER TABLE restaurantes
  ADD COLUMN IF NOT EXISTS gadget_live_session_type TEXT DEFAULT 'comercial';

DO $$ BEGIN
  ALTER TABLE restaurantes
    ADD CONSTRAINT restaurantes_live_session_type_check
    CHECK (gadget_live_session_type IN ('socio', 'comercial'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE restaurantes
SET gadget_live_session_type = 'comercial'
WHERE gadget_live_session_type IS NULL;

-- Stamp authenticated diner + VIP snapshot on each live order
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS calorias INTEGER DEFAULT 0;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS proteinas NUMERIC DEFAULT 0;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS carbohidratos NUMERIC DEFAULT 0;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS grasas NUMERIC DEFAULT 0;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS es_alcohol BOOLEAN DEFAULT false;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS categoria_nombre TEXT;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS vip_badge TEXT;
ALTER TABLE pedidos_live ADD COLUMN IF NOT EXISTS preferencias TEXT;

DO $$ BEGIN
  ALTER TABLE pedidos_live
    ADD CONSTRAINT pedidos_live_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS pedidos_live_user_idx
  ON pedidos_live(user_id, restaurante_id);

ALTER TABLE sesiones_mesa ADD COLUMN IF NOT EXISTS vip_resumen JSONB DEFAULT '[]'::jsonb;

-- Member / frequent diner profiles (PII)
CREATE TABLE IF NOT EXISTS live_socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  numero_socio TEXT,
  cedula TEXT,
  email TEXT,
  nombre TEXT NOT NULL DEFAULT '',
  preferencias TEXT,
  puntos INTEGER NOT NULL DEFAULT 0,
  cashback NUMERIC NOT NULL DEFAULT 0,
  nivel TEXT NOT NULL DEFAULT 'nuevo',
  visitas INTEGER NOT NULL DEFAULT 0,
  platos_probados INTEGER NOT NULL DEFAULT 0,
  kcal_acumuladas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT live_socios_nivel_check CHECK (nivel IN ('nuevo', 'frecuente', 'gold', 'platinum'))
);

CREATE UNIQUE INDEX IF NOT EXISTS live_socios_user_unique
  ON live_socios(restaurante_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS live_socios_numero_unique
  ON live_socios(restaurante_id, numero_socio)
  WHERE numero_socio IS NOT NULL AND numero_socio <> '';

CREATE INDEX IF NOT EXISTS live_socios_cedula_idx
  ON live_socios(restaurante_id, cedula);

CREATE INDEX IF NOT EXISTS live_socios_email_idx
  ON live_socios(restaurante_id, email);

ALTER TABLE live_socios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_socios_select_own ON live_socios;
CREATE POLICY live_socios_select_own ON live_socios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS live_socios_update_own ON live_socios;
CREATE POLICY live_socios_update_own ON live_socios
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
