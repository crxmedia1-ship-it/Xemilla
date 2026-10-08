-- Sucursales: cada restaurante (marca) puede tener varias sedes con su propia
-- ubicación/contacto y su propia disponibilidad de platos.
-- El menú (categorías, platos, precios) sigue siendo de la marca; las sedes
-- solo sobrescriben lo que difiere. Los campos NULL heredan del restaurante.

CREATE TABLE IF NOT EXISTS public.sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  slug text NOT NULL,
  nombre text NOT NULL,
  direccion text,
  horarios text,
  whatsapp_num text,
  coordenadas_maps text,
  zona_horaria text NOT NULL DEFAULT 'America/Caracas',
  es_principal boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sucursales_slug_formato CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT sucursales_slug_reservado CHECK (slug NOT IN ('menu', 'admin', 'api')),
  CONSTRAINT sucursales_nombre_no_vacio CHECK (length(btrim(nombre)) > 0),
  CONSTRAINT sucursales_slug_unico UNIQUE (restaurante_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS sucursales_una_principal
  ON public.sucursales (restaurante_id) WHERE es_principal;

CREATE INDEX IF NOT EXISTS sucursales_restaurante_idx
  ON public.sucursales (restaurante_id, orden);

-- Agotado por sede. Sin fila = disponible (si el plato lo está en la marca).
-- agotado_hasta NULL = agotado indefinido; con fecha = vuelve solo al pasar.
CREATE TABLE IF NOT EXISTS public.plato_sucursal (
  sucursal_id uuid NOT NULL REFERENCES public.sucursales (id) ON DELETE CASCADE,
  plato_id bigint NOT NULL REFERENCES public.platos (id) ON DELETE CASCADE,
  restaurante_id uuid NOT NULL REFERENCES public.restaurantes (id) ON DELETE CASCADE,
  agotado boolean NOT NULL DEFAULT true,
  agotado_hasta timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sucursal_id, plato_id)
);

CREATE INDEX IF NOT EXISTS plato_sucursal_restaurante_idx
  ON public.plato_sucursal (restaurante_id);

-- Coherencia: la sede y el plato deben ser del mismo restaurante.
CREATE OR REPLACE FUNCTION private.plato_sucursal_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT s.restaurante_id INTO NEW.restaurante_id
  FROM public.sucursales s WHERE s.id = NEW.sucursal_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.platos p
    WHERE p.id = NEW.plato_id AND p.restaurante_id = NEW.restaurante_id
  ) THEN
    RAISE EXCEPTION 'El plato no pertenece al restaurante de la sucursal';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plato_sucursal_check ON public.plato_sucursal;
CREATE TRIGGER plato_sucursal_check
  BEFORE INSERT OR UPDATE ON public.plato_sucursal
  FOR EACH ROW EXECUTE FUNCTION private.plato_sucursal_check();

CREATE OR REPLACE FUNCTION private.sucursales_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sucursales_touch ON public.sucursales;
CREATE TRIGGER sucursales_touch
  BEFORE UPDATE ON public.sucursales
  FOR EACH ROW EXECUTE FUNCTION private.sucursales_touch();

-- Todo restaurante nace con su sede principal (hereda todo de la marca).
CREATE OR REPLACE FUNCTION private.crear_sucursal_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sucursales (restaurante_id, slug, nombre, es_principal, orden)
  VALUES (NEW.id, 'principal', 'Principal', true, 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurantes_crear_sucursal_principal ON public.restaurantes;
CREATE TRIGGER restaurantes_crear_sucursal_principal
  AFTER INSERT ON public.restaurantes
  FOR EACH ROW EXECUTE FUNCTION private.crear_sucursal_principal();

INSERT INTO public.sucursales (restaurante_id, slug, nombre, es_principal, orden)
SELECT r.id, 'principal', 'Principal', true, 0
FROM public.restaurantes r
WHERE NOT EXISTS (
  SELECT 1 FROM public.sucursales s WHERE s.restaurante_id = r.id AND s.es_principal
);

-- RLS: lectura pública (el menú la necesita), escritura solo gestores.
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plato_sucursal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sucursales_select_publico ON public.sucursales;
CREATE POLICY sucursales_select_publico ON public.sucursales
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS sucursales_insert_gestor ON public.sucursales;
CREATE POLICY sucursales_insert_gestor ON public.sucursales
  FOR INSERT TO authenticated WITH CHECK (private.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS sucursales_update_gestor ON public.sucursales;
CREATE POLICY sucursales_update_gestor ON public.sucursales
  FOR UPDATE TO authenticated
  USING (private.can_manage_restaurante(restaurante_id))
  WITH CHECK (private.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS sucursales_delete_gestor ON public.sucursales;
CREATE POLICY sucursales_delete_gestor ON public.sucursales
  FOR DELETE TO authenticated
  USING (private.can_manage_restaurante(restaurante_id) AND NOT es_principal);

DROP POLICY IF EXISTS plato_sucursal_select_publico ON public.plato_sucursal;
CREATE POLICY plato_sucursal_select_publico ON public.plato_sucursal
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS plato_sucursal_insert_gestor ON public.plato_sucursal;
CREATE POLICY plato_sucursal_insert_gestor ON public.plato_sucursal
  FOR INSERT TO authenticated
  WITH CHECK (
    private.can_manage_restaurante(
      (SELECT s.restaurante_id FROM public.sucursales s WHERE s.id = sucursal_id)
    )
  );

DROP POLICY IF EXISTS plato_sucursal_update_gestor ON public.plato_sucursal;
CREATE POLICY plato_sucursal_update_gestor ON public.plato_sucursal
  FOR UPDATE TO authenticated
  USING (private.can_manage_restaurante(restaurante_id))
  WITH CHECK (private.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS plato_sucursal_delete_gestor ON public.plato_sucursal;
CREATE POLICY plato_sucursal_delete_gestor ON public.plato_sucursal
  FOR DELETE TO authenticated USING (private.can_manage_restaurante(restaurante_id));

REVOKE ALL ON FUNCTION private.plato_sucursal_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.crear_sucursal_principal() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sucursales_touch() FROM PUBLIC;
