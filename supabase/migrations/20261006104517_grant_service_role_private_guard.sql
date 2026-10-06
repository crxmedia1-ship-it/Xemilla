-- El trigger de UPDATE vive en private. service_role no tenía USAGE,
-- así que guardar la ficha (incluido el diseño) fallaba con
-- "permission denied for schema private".

grant usage on schema private to service_role;
grant execute on function private.guard_restaurante_update() to service_role;
grant execute on function private.is_superadmin() to service_role;
grant execute on function private.can_manage_restaurante(uuid) to service_role;

create or replace function private.guard_restaurante_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed text[] := array[
    'nombre_comercial',
    'whatsapp_num',
    'whatsapp_url',
    'logo_url',
    'horarios',
    'eslogan',
    'direccion',
    'coordenadas_maps',
    'popup_banner',
    'instagram_url',
    'redes_sociales',
    'ui_estilo'
  ];
begin
  if current_user is distinct from 'authenticated' and current_user is distinct from 'anon' then
    return new;
  end if;

  if private.is_superadmin() then
    return new;
  end if;

  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Solo SuperAdmin puede modificar estos campos del restaurante'
      using errcode = '42501';
  end if;

  if (coalesce(new.ui_estilo, '{}'::jsonb) - 'hub')
     is distinct from (coalesce(old.ui_estilo, '{}'::jsonb) - 'hub') then
    raise exception 'Solo SuperAdmin puede modificar el estilo del restaurante'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
