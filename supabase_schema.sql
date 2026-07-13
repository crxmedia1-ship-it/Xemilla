-- =============================================================================
-- CRX Restaurantes · Esquema multi-inquilino (Supabase / PostgreSQL)
-- =============================================================================
-- Alimenta el menú público (por slug) y el Dashboard de administración.
-- Ejecutar en el SQL Editor de Supabase (o como migración).
-- =============================================================================

-- Extensiones útiles (UUID). En proyectos Supabase suelen estar habilitadas.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) restaurantes
-- Un registro por inquilino / marca. `user_id` vincula al dueño en auth.users.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurantes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  nombre_comercial TEXT NOT NULL,
  whatsapp_num    TEXT,
  gadget_wifi     BOOLEAN NOT NULL DEFAULT FALSE,
  gadget_dividir_cuenta BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT restaurantes_slug_unique UNIQUE (slug),
  CONSTRAINT restaurantes_slug_formato CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

COMMENT ON TABLE public.restaurantes IS
  'Inquilinos del SaaS CRX. Cada fila es una marca/restaurante administrable.';
COMMENT ON COLUMN public.restaurantes.slug IS
  'Identificador público en la URL (ej: blacksushi, sanza).';
COMMENT ON COLUMN public.restaurantes.user_id IS
  'Propietario del restaurante; referencia a auth.users para login.';
COMMENT ON COLUMN public.restaurantes.gadget_wifi IS
  'Activa el gadget Wi‑Fi en la experiencia móvil pública.';
COMMENT ON COLUMN public.restaurantes.gadget_dividir_cuenta IS
  'Activa el gadget Dividir cuenta en la experiencia móvil pública.';

CREATE INDEX IF NOT EXISTS idx_restaurantes_user_id
  ON public.restaurantes (user_id);

-- -----------------------------------------------------------------------------
-- 2) categorias
-- Agrupan platos del menú (Entradas, Rolls Premium, etc.) por restaurante.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurante_id  UUID NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  orden           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT categorias_nombre_por_restaurante UNIQUE (restaurante_id, nombre)
);

COMMENT ON TABLE public.categorias IS
  'Categorías del menú por restaurante, ordenadas visualmente con `orden`.';
COMMENT ON COLUMN public.categorias.orden IS
  'Posición de la categoría en la barra horizontal / listado del menú.';

CREATE INDEX IF NOT EXISTS idx_categorias_restaurante_orden
  ON public.categorias (restaurante_id, orden);

-- -----------------------------------------------------------------------------
-- 3) platos
-- Ítems del menú vinculados a restaurante y categoría.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurante_id  UUID NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  categoria_id    BIGINT NOT NULL REFERENCES public.categorias (id) ON DELETE RESTRICT,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  precio          NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
  imagen_url      TEXT,
  disponible      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.platos IS
  'Platos del menú público y del dashboard. imagen_url pensada para Cloudinary.';
COMMENT ON COLUMN public.platos.disponible IS
  'Si es false, el plato puede ocultarse o marcarse como agotado en la UI.';
COMMENT ON COLUMN public.platos.imagen_url IS
  'URL absoluta de imagen (p. ej. Cloudinary).';

CREATE INDEX IF NOT EXISTS idx_platos_restaurante_id
  ON public.platos (restaurante_id);

CREATE INDEX IF NOT EXISTS idx_platos_categoria_id
  ON public.platos (categoria_id);

CREATE INDEX IF NOT EXISTS idx_platos_disponibles
  ON public.platos (restaurante_id, disponible)
  WHERE disponible = TRUE;

-- Garantiza que la categoría pertenece al mismo restaurante que el plato.
CREATE OR REPLACE FUNCTION public.platos_categoria_mismo_restaurante()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cat_restaurante_id UUID;
BEGIN
  SELECT c.restaurante_id
    INTO cat_restaurante_id
    FROM public.categorias c
   WHERE c.id = NEW.categoria_id;

  IF cat_restaurante_id IS NULL THEN
    RAISE EXCEPTION 'categoria_id % no existe', NEW.categoria_id;
  END IF;

  IF cat_restaurante_id <> NEW.restaurante_id THEN
    RAISE EXCEPTION
      'El plato debe pertenecer al mismo restaurante que su categoría';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platos_categoria_mismo_restaurante ON public.platos;
CREATE TRIGGER trg_platos_categoria_mismo_restaurante
  BEFORE INSERT OR UPDATE OF restaurante_id, categoria_id
  ON public.platos
  FOR EACH ROW
  EXECUTE FUNCTION public.platos_categoria_mismo_restaurante();

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurantes_updated_at ON public.restaurantes;
CREATE TRIGGER trg_restaurantes_updated_at
  BEFORE UPDATE ON public.restaurantes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_platos_updated_at ON public.platos;
CREATE TRIGGER trg_platos_updated_at
  BEFORE UPDATE ON public.platos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Row Level Security (RLS)
-- - Lectura pública: menú y ficha del restaurante (experiencia /[slug]).
-- - Escritura: solo el propietario autenticado (auth.uid() = user_id).
-- =============================================================================

ALTER TABLE public.restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platos ENABLE ROW LEVEL SECURITY;

-- ----- restaurantes -----
DROP POLICY IF EXISTS "restaurantes_select_publico" ON public.restaurantes;
CREATE POLICY "restaurantes_select_publico"
  ON public.restaurantes
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "restaurantes_insert_propietario" ON public.restaurantes;
CREATE POLICY "restaurantes_insert_propietario"
  ON public.restaurantes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "restaurantes_update_propietario" ON public.restaurantes;
CREATE POLICY "restaurantes_update_propietario"
  ON public.restaurantes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "restaurantes_delete_propietario" ON public.restaurantes;
CREATE POLICY "restaurantes_delete_propietario"
  ON public.restaurantes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----- categorias -----
DROP POLICY IF EXISTS "categorias_select_publico" ON public.categorias;
CREATE POLICY "categorias_select_publico"
  ON public.categorias
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "categorias_insert_propietario" ON public.categorias;
CREATE POLICY "categorias_insert_propietario"
  ON public.categorias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "categorias_update_propietario" ON public.categorias;
CREATE POLICY "categorias_update_propietario"
  ON public.categorias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "categorias_delete_propietario" ON public.categorias;
CREATE POLICY "categorias_delete_propietario"
  ON public.categorias
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  );

-- ----- platos -----
DROP POLICY IF EXISTS "platos_select_publico" ON public.platos;
CREATE POLICY "platos_select_publico"
  ON public.platos
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "platos_insert_propietario" ON public.platos;
CREATE POLICY "platos_insert_propietario"
  ON public.platos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "platos_update_propietario" ON public.platos;
CREATE POLICY "platos_update_propietario"
  ON public.platos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "platos_delete_propietario" ON public.platos;
CREATE POLICY "platos_delete_propietario"
  ON public.platos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurantes r
      WHERE r.id = restaurante_id
        AND r.user_id = auth.uid()
    )
  );

-- =============================================================================
-- SuperAdmin (dueño del SaaS)
-- Permite al correo maestro editar cualquier plato / restaurante vía JWT.
-- Ajustá el email si tu cuenta maestra es otra.
-- Alternativa app: SUPABASE_SERVICE_ROLE_KEY en el servidor (bypassa RLS).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'carlos@crx.com';
$$;

COMMENT ON FUNCTION public.is_superadmin() IS
  'True si el JWT pertenece al SuperAdmin de Xemilla (correo maestro).';

DROP POLICY IF EXISTS "restaurantes_update_superadmin" ON public.restaurantes;
CREATE POLICY "restaurantes_update_superadmin"
  ON public.restaurantes
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "restaurantes_insert_superadmin" ON public.restaurantes;
CREATE POLICY "restaurantes_insert_superadmin"
  ON public.restaurantes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "restaurantes_delete_superadmin" ON public.restaurantes;
CREATE POLICY "restaurantes_delete_superadmin"
  ON public.restaurantes
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

DROP POLICY IF EXISTS "platos_update_superadmin" ON public.platos;
CREATE POLICY "platos_update_superadmin"
  ON public.platos
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "platos_insert_superadmin" ON public.platos;
CREATE POLICY "platos_insert_superadmin"
  ON public.platos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "platos_delete_superadmin" ON public.platos;
CREATE POLICY "platos_delete_superadmin"
  ON public.platos
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

DROP POLICY IF EXISTS "categorias_all_superadmin" ON public.categorias;
CREATE POLICY "categorias_all_superadmin"
  ON public.categorias
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- =============================================================================
-- Notas de uso
-- =============================================================================
-- 1. Pegar este archivo en Supabase → SQL → New query → Run.
-- 2. Crear usuarios vía Auth; luego insertar en restaurantes con ese user_id.
-- 3. El frontend público puede leer por slug (anon key) sin login.
-- 4. El Dashboard debe usar la sesión del propietario (authenticated).
-- 5. SuperAdmin: cuenta con email = carlos@crx.com (o el de is_superadmin()).
-- 6. Panel maestro: /admin/super/dashboard — env SUPERADMIN_EMAIL.
-- =============================================================================
