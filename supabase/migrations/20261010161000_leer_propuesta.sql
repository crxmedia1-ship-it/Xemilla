-- El enlace público /propuesta?p= necesita leer una sola fila.
-- Sin service role (como en el sitio publicado) la página decía que el enlace ya no estaba.
-- No hay policy de listado para anon: solo esta función, y solo con el id del enlace.

create or replace function public.leer_propuesta(pid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'logo_url', p.logo_url,
    'setup', p.setup,
    'anual', p.anual,
    'sin_precio', p.sin_precio,
    'dominio', p.dominio,
    'mundo', p.mundo,
    'adicionales', p.adicionales,
    'created_at', p.created_at
  )
  from public.propuestas p
  where p.id = pid;
$$;

revoke all on function public.leer_propuesta(uuid) from public;
revoke all on function public.leer_propuesta(uuid) from anon, authenticated;
grant execute on function public.leer_propuesta(uuid) to anon, authenticated, service_role;
