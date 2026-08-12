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

-- Módulos Lego (gadgets + configs + estilos avanzados)
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS gadget_reservas BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gadget_llamar_mesero BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS config_reservas JSONB,
  ADD COLUMN IF NOT EXISTS config_wifi JSONB,
  ADD COLUMN IF NOT EXISTS custom_css TEXT;

COMMENT ON COLUMN public.restaurantes.gadget_reservas IS
  'Activa el módulo Reservas (CTA flotante / panel).';
COMMENT ON COLUMN public.restaurantes.gadget_llamar_mesero IS
  'Activa el gadget Llamar mesero.';
COMMENT ON COLUMN public.restaurantes.config_reservas IS
  'JSON: { "url": "https://…", "label": "Reservar mesa" }.';
COMMENT ON COLUMN public.restaurantes.config_wifi IS
  'JSON: { "ssid": "…", "password": "…" }.';
COMMENT ON COLUMN public.restaurantes.custom_css IS
  'CSS scoped por restaurante (inyectado en la WebApp pública).';

-- Gadgets: columnas planas canónicas (+ aliases legacy sincronizados en API)
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS gadget_wifi_ssid TEXT,
  ADD COLUMN IF NOT EXISTS gadget_wifi_clave TEXT,
  ADD COLUMN IF NOT EXISTS gadget_mesero BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gadget_cuenta BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.restaurantes.gadget_wifi_ssid IS
  'SSID de la red Wi‑Fi de invitados (plano).';
COMMENT ON COLUMN public.restaurantes.gadget_wifi_clave IS
  'Clave de la red Wi‑Fi de invitados (plano).';
COMMENT ON COLUMN public.restaurantes.gadget_mesero IS
  'Activa el gadget Llamar mesero (canónico; alias de gadget_llamar_mesero).';
COMMENT ON COLUMN public.restaurantes.gadget_cuenta IS
  'Activa Pedir/Dividir cuenta (canónico; alias de gadget_dividir_cuenta).';

-- Boutique / merch
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS gadget_boutique BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS config_boutique JSONB;

COMMENT ON COLUMN public.restaurantes.gadget_boutique IS
  'Activa el bloque Carrd Boutique / Merchandise en la WebApp pública.';
COMMENT ON COLUMN public.restaurantes.config_boutique IS
  'JSON: { "productos": [{ "id", "nombre", "precio", "imagen_url", "activo" }] }.';

-- Backfill desde columnas legacy / JSON
UPDATE public.restaurantes
SET gadget_mesero = TRUE
WHERE gadget_llamar_mesero IS TRUE AND gadget_mesero IS NOT TRUE;

UPDATE public.restaurantes
SET gadget_cuenta = TRUE
WHERE gadget_dividir_cuenta IS TRUE AND gadget_cuenta IS NOT TRUE;

UPDATE public.restaurantes
SET gadget_wifi_ssid = NULLIF(TRIM(config_wifi->>'ssid'), '')
WHERE (gadget_wifi_ssid IS NULL OR TRIM(gadget_wifi_ssid) = '')
  AND config_wifi ? 'ssid';

UPDATE public.restaurantes
SET gadget_wifi_clave = NULLIF(TRIM(config_wifi->>'password'), '')
WHERE (gadget_wifi_clave IS NULL OR TRIM(gadget_wifi_clave) = '')
  AND config_wifi ? 'password';

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS eslogan TEXT,
  ADD COLUMN IF NOT EXISTS secciones_fondo JSONB;

COMMENT ON COLUMN public.restaurantes.logo_url IS
  'URL del logo (Home). Si vacío, se usa inicial tipográfica.';
COMMENT ON COLUMN public.restaurantes.eslogan IS
  'Eslogan / tagline público del restaurante.';
COMMENT ON COLUMN public.restaurantes.secciones_fondo IS
  'JSON por sección: { home|nosotros|menu|ubicacion: { tipo: color|image|video, valor } }.';

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS nosotros_bloques JSONB,
  ADD COLUMN IF NOT EXISTS redes_sociales JSONB;

COMMENT ON COLUMN public.restaurantes.nosotros_bloques IS
  'Array editorial: [{ titulo, texto, media_url, alineacion: alternada|inversa }].';
COMMENT ON COLUMN public.restaurantes.redes_sociales IS
  'Array de redes: [{ red: instagram|facebook|tiktok|tripadvisor, url }]. Editable por operativo vía POST /api/update-operativo-contacto (instagram + facebook|tiktok; aislado de ui_estilo).';

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS bg_type TEXT,
  ADD COLUMN IF NOT EXISTS bg_valor TEXT;

COMMENT ON COLUMN public.categorias.bg_type IS
  'Fondo dinámico del menú al enfocar la categoría: color | image | video.';
COMMENT ON COLUMN public.categorias.bg_valor IS
  'HEX o URL de media para el fondo de la categoría.';

-- Marca blanca (white-label). Nullable → la WebApp usa fallbacks Black Sushi.
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS color_primario TEXT,
  ADD COLUMN IF NOT EXISTS color_fondo TEXT,
  ADD COLUMN IF NOT EXISTS color_texto TEXT,
  ADD COLUMN IF NOT EXISTS tipo_letra TEXT,
  ADD COLUMN IF NOT EXISTS imagen_fondo TEXT;

COMMENT ON COLUMN public.restaurantes.color_primario IS
  'Acento de marca (hex/rgb). Chips activos, CTAs.';
COMMENT ON COLUMN public.restaurantes.color_fondo IS
  'Fondo de la WebApp móvil.';
COMMENT ON COLUMN public.restaurantes.color_texto IS
  'Color de texto principal.';
COMMENT ON COLUMN public.restaurantes.tipo_letra IS
  'Familia tipográfica CSS (ej: Syne, sans-serif).';
COMMENT ON COLUMN public.restaurantes.imagen_fondo IS
  'URL de imagen de atmósfera (Cloudinary u otra).';

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS estilo_adn TEXT;

COMMENT ON COLUMN public.restaurantes.estilo_adn IS
  'ADN de diseño: elegant | modern | retro (Design System Xemilla).';

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS menu_font TEXT;

COMMENT ON COLUMN public.restaurantes.menu_font IS
  'Tipografía del menú: elegant (Playfair) | modern (Space Grotesk) | urban (Oswald).';

ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS share_image_url TEXT,
  ADD COLUMN IF NOT EXISTS app_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS ui_estilo JSONB;

COMMENT ON COLUMN public.restaurantes.share_image_url IS
  'Imagen Open Graph / WhatsApp (og:image).';
COMMENT ON COLUMN public.restaurantes.app_icon_url IS
  'Icono PWA / apple-touch-icon para descarga a pantalla de inicio.';
COMMENT ON COLUMN public.restaurantes.ui_estilo IS
  'Tokens UI JSONB. home: estilo_navegacion (frontal|hamburguesa|app_tabs), fondo_animacion (in|out|pan|float|glow|ninguna), overlay_estilo (puro|gradiente|vineta|oscuro|cinematico), sizes/offsets px, colores, css_avanzado.';

-- Portada exclusiva del Hub SuperAdmin (NO es el fondo de la WebApp pública)
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS hub_cover_url TEXT;

COMMENT ON COLUMN public.restaurantes.hub_cover_url IS
  'Foto de portada para Visual Cards del Hub SuperAdmin. Independiente de imagen_fondo / secciones_fondo (WebApp).';

-- Color de la placa del logo en el Hub (muestreado desde el cover)
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS hub_logo_bg TEXT;

COMMENT ON COLUMN public.restaurantes.hub_logo_bg IS
  'Color hex de la placa del logo en Visual Cards. Suele derivarse de la franja inferior del hub_cover_url.';

-- Plantillas de estructura (Layout Themes)
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS home_theme TEXT NOT NULL DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS ubicacion_theme TEXT NOT NULL DEFAULT 'modal';

COMMENT ON COLUMN public.restaurantes.home_theme IS
  'Plantilla Home: editorial | hero | bento.';
COMMENT ON COLUMN public.restaurantes.ubicacion_theme IS
  'Plantilla Ubicación: modal | split.';

-- Contenido público (ubicación / horarios / nosotros) — editable sin tocar código.
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS horarios TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_url TEXT,
  ADD COLUMN IF NOT EXISTS coordenadas_maps TEXT,
  ADD COLUMN IF NOT EXISTS nosotros_subtitulo TEXT,
  ADD COLUMN IF NOT EXISTS nosotros_titulo TEXT,
  ADD COLUMN IF NOT EXISTS nosotros_imagen TEXT,
  ADD COLUMN IF NOT EXISTS nosotros_texto TEXT;

COMMENT ON COLUMN public.restaurantes.direccion IS
  'Dirección pública (ej: Chuao, Caracas. Venezuela.).';
COMMENT ON COLUMN public.restaurantes.horarios IS
  'Horarios multilínea Carrd (usar \\n entre líneas). Editable por operativo vía POST /api/update-operativo-contacto (whitelist: horarios + whatsapp_url + instagram_url + redes_sociales).';
COMMENT ON COLUMN public.restaurantes.instagram_url IS
  'URL completa de Instagram del restaurante. Editable por operativo vía POST /api/update-operativo-contacto (sync con redes_sociales; aislado de ui_estilo / Identidad).';
COMMENT ON COLUMN public.restaurantes.whatsapp_url IS
  'WhatsApp: número E.164 o URL wa.me / api.whatsapp.com. Editable por operativo vía POST /api/update-operativo-contacto (aislado de ui_estilo / Identidad).';
COMMENT ON COLUMN public.restaurantes.coordenadas_maps IS
  'URL de Google Maps (enlace o búsqueda).';
COMMENT ON COLUMN public.restaurantes.nosotros_subtitulo IS
  'Eyebrow editorial de la sección Nosotros.';
COMMENT ON COLUMN public.restaurantes.nosotros_titulo IS
  'Título editorial de la sección Nosotros.';
COMMENT ON COLUMN public.restaurantes.nosotros_imagen IS
  'URL de imagen del bloque Nosotros.';
COMMENT ON COLUMN public.restaurantes.nosotros_texto IS
  'Párrafo / copy de la sección Nosotros.';

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
  destacado       BOOLEAN NOT NULL DEFAULT FALSE,
  orden           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.platos IS
  'Platos del menú público y del dashboard. imagen_url pensada para Cloudinary.';
COMMENT ON COLUMN public.platos.disponible IS
  'Si es false, el plato puede ocultarse o marcarse como agotado en la UI.';
COMMENT ON COLUMN public.platos.imagen_url IS
  'URL absoluta de imagen (p. ej. Cloudinary).';
COMMENT ON COLUMN public.platos.destacado IS
  'Marca el plato como destacado en menú / panel admin.';

-- Migración segura si la tabla ya existía sin la columna
ALTER TABLE public.platos
  ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE;

-- Orden visual del plato dentro de su categoría (1..n relativo en el admin).
-- REQUIRED MIGRATION: run in Supabase SQL editor if the column is missing.
ALTER TABLE public.platos
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.platos.orden IS
  'Posición del plato dentro de su categoría (orden visual del menú / admin).';

CREATE INDEX IF NOT EXISTS idx_platos_restaurante_categoria_orden
  ON public.platos (restaurante_id, categoria_id, orden);

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

-- -----------------------------------------------------------------------------
-- Alertas de mesa (llamar mesero / pedir cuenta) — realtime admin
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alertas_mesas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id  UUID NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  mesa            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('mesero', 'cuenta')),
  atendida        BOOLEAN NOT NULL DEFAULT FALSE,
  atendida_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alertas_mesas
  ADD COLUMN IF NOT EXISTS atendida_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS alertas_mesas_rest_atendida_idx
  ON public.alertas_mesas (restaurante_id, atendida, created_at DESC);

COMMENT ON TABLE public.alertas_mesas IS
  'Solicitudes en vivo desde la WebApp (llamar mesero / pedir cuenta).';
COMMENT ON COLUMN public.alertas_mesas.tipo IS
  'mesero | cuenta';
COMMENT ON COLUMN public.alertas_mesas.atendida_at IS
  'Momento en que el staff marcó la alerta como atendida (KPI de respuesta).';

-- Contador de vistas de platos (pre-cableado para analytics)
CREATE TABLE IF NOT EXISTS public.plato_vistas (
  id              BIGSERIAL PRIMARY KEY,
  restaurante_id  UUID NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  plato_id        BIGINT REFERENCES public.platos (id) ON DELETE CASCADE,
  plato_nombre    TEXT,
  vistas          INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plato_vistas_unique UNIQUE (restaurante_id, plato_id)
);

ALTER TABLE public.plato_vistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plato_vistas_select_owner" ON public.plato_vistas;
CREATE POLICY "plato_vistas_select_owner"
  ON public.plato_vistas
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR restaurante_id IN (
      SELECT id FROM public.restaurantes WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.alertas_mesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_mesas_insert_public" ON public.alertas_mesas;
CREATE POLICY "alertas_mesas_insert_public"
  ON public.alertas_mesas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "alertas_mesas_select_owner" ON public.alertas_mesas;
CREATE POLICY "alertas_mesas_select_owner"
  ON public.alertas_mesas
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR restaurante_id IN (
      SELECT id FROM public.restaurantes WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "alertas_mesas_update_owner" ON public.alertas_mesas;
CREATE POLICY "alertas_mesas_update_owner"
  ON public.alertas_mesas
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin()
    OR restaurante_id IN (
      SELECT id FROM public.restaurantes WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR restaurante_id IN (
      SELECT id FROM public.restaurantes WHERE user_id = auth.uid()
    )
  );

-- Realtime (ignorar error si ya está en la publication)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_mesas;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Notas de uso
-- =============================================================================
-- 1. Pegar este archivo en Supabase → SQL → New query → Run.
-- 2. Crear usuarios vía Auth; luego insertar en restaurantes con ese user_id.
-- 3. El frontend público puede leer por slug (anon key) sin login.
-- 4. El Dashboard debe usar la sesión del propietario (authenticated).
-- 5. SuperAdmin: cuenta con email = carlos@crx.com (o el de is_superadmin()).
-- 6. Panel maestro: /admin/super/dashboard — env SUPERADMIN_EMAIL.
-- 7. Fotos de platos: crear bucket Storage público llamado "platos".
-- 8. Alertas mesa: habilitar Realtime en alertas_mesas (Dashboard → Database → Replication).
-- =============================================================================
