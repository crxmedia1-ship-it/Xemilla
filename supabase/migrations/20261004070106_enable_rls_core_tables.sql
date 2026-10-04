-- RLS en tablas núcleo: lectura pública del menú; escritura solo para quien gestiona el restaurante.

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'carlos@crx.com'
      OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin';
$$;

-- SECURITY DEFINER evita recursión con la RLS de restaurantes.
CREATE OR REPLACE FUNCTION public.can_manage_restaurante(rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1
    FROM public.restaurantes r
    WHERE r.id = rid
      AND (
        r.user_id = auth.uid()
        OR r.id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'restaurante_id', '')
        OR r.slug = coalesce(auth.jwt() -> 'app_metadata' ->> 'restaurante_id', '')
      )
  );
$$;

ALTER TABLE public.restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platos ENABLE ROW LEVEL SECURITY;

-- restaurantes
DROP POLICY IF EXISTS restaurantes_select_publico ON public.restaurantes;
CREATE POLICY restaurantes_select_publico ON public.restaurantes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS restaurantes_update_gestor ON public.restaurantes;
CREATE POLICY restaurantes_update_gestor ON public.restaurantes
  FOR UPDATE TO authenticated
  USING (public.can_manage_restaurante(id))
  WITH CHECK (public.can_manage_restaurante(id));

DROP POLICY IF EXISTS restaurantes_insert_superadmin ON public.restaurantes;
CREATE POLICY restaurantes_insert_superadmin ON public.restaurantes
  FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS restaurantes_delete_superadmin ON public.restaurantes;
CREATE POLICY restaurantes_delete_superadmin ON public.restaurantes
  FOR DELETE TO authenticated USING (public.is_superadmin());

-- categorias
DROP POLICY IF EXISTS categorias_select_publico ON public.categorias;
CREATE POLICY categorias_select_publico ON public.categorias
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS categorias_insert_gestor ON public.categorias;
CREATE POLICY categorias_insert_gestor ON public.categorias
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS categorias_update_gestor ON public.categorias;
CREATE POLICY categorias_update_gestor ON public.categorias
  FOR UPDATE TO authenticated
  USING (public.can_manage_restaurante(restaurante_id))
  WITH CHECK (public.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS categorias_delete_gestor ON public.categorias;
CREATE POLICY categorias_delete_gestor ON public.categorias
  FOR DELETE TO authenticated USING (public.can_manage_restaurante(restaurante_id));

-- platos
DROP POLICY IF EXISTS platos_select_publico ON public.platos;
CREATE POLICY platos_select_publico ON public.platos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS platos_insert_gestor ON public.platos;
CREATE POLICY platos_insert_gestor ON public.platos
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS platos_update_gestor ON public.platos;
CREATE POLICY platos_update_gestor ON public.platos
  FOR UPDATE TO authenticated
  USING (public.can_manage_restaurante(restaurante_id))
  WITH CHECK (public.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS platos_delete_gestor ON public.platos;
CREATE POLICY platos_delete_gestor ON public.platos
  FOR DELETE TO authenticated USING (public.can_manage_restaurante(restaurante_id));

-- plato_vistas: métricas privadas; inserción anónima solo de platos reales del restaurante
DROP POLICY IF EXISTS "Permitir lectura de vistas a administradores" ON public.plato_vistas;
DROP POLICY IF EXISTS plato_vistas_select_gestor ON public.plato_vistas;
CREATE POLICY plato_vistas_select_gestor ON public.plato_vistas
  FOR SELECT TO authenticated USING (public.can_manage_restaurante(restaurante_id));

DROP POLICY IF EXISTS "Permitir inserciones anónimas de vistas" ON public.plato_vistas;
DROP POLICY IF EXISTS plato_vistas_insert_publico ON public.plato_vistas;
CREATE POLICY plato_vistas_insert_publico ON public.plato_vistas
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platos p
      WHERE p.id = plato_vistas.plato_id AND p.restaurante_id = plato_vistas.restaurante_id
    )
  );

ALTER FUNCTION public.set_atendida_timestamp() SET search_path = public;
