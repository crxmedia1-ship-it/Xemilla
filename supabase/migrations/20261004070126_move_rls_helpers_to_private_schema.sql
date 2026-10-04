-- Helpers de RLS fuera del esquema expuesto por la API (sin /rest/v1/rpc/*).
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

ALTER FUNCTION public.is_superadmin() SET SCHEMA private;
ALTER FUNCTION public.can_manage_restaurante(uuid) SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.can_manage_restaurante(rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_superadmin() OR EXISTS (
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

REVOKE ALL ON FUNCTION private.is_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_restaurante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_superadmin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_restaurante(uuid) TO anon, authenticated;
