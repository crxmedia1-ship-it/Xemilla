-- Admin Operativo: solo puede editar los campos de su panel.
-- Slug, activo, user_id, gadgets, colores, CSS y el resto de Identidad de Marca
-- quedan reservados a SuperAdmin / service role, aunque se llame a PostgREST directo.

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
  if current_user not in ('authenticated', 'anon') or private.is_superadmin() then
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

drop trigger if exists guard_restaurante_update on public.restaurantes;
create trigger guard_restaurante_update
  before update on public.restaurantes
  for each row execute function private.guard_restaurante_update();
