-- Gerentes de sede: un usuario Auth que solo puede agotar/reactivar platos
-- en una sucursal. No lleva `restaurante_id` en app_metadata (eso daría
-- acceso completo vía private.can_manage_restaurante); el permiso vive en
-- esta tabla, así quitarlo es inmediato.

create table if not exists public.sucursal_gerentes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists sucursal_gerentes_sucursal_idx on public.sucursal_gerentes (sucursal_id);
create index if not exists sucursal_gerentes_restaurante_idx on public.sucursal_gerentes (restaurante_id);

alter table public.sucursal_gerentes enable row level security;

-- Altas y bajas solo con service role (API de SuperAdmin): sin políticas de escritura.
drop policy if exists sucursal_gerentes_select on public.sucursal_gerentes;
create policy sucursal_gerentes_select on public.sucursal_gerentes
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_restaurante(restaurante_id));

create or replace function private.can_manage_sucursal(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sucursales s
    where s.id = sid and private.can_manage_restaurante(s.restaurante_id)
  ) or exists (
    select 1 from public.sucursal_gerentes g
    where g.sucursal_id = sid and g.user_id = auth.uid()
  );
$$;

revoke all on function private.can_manage_sucursal(uuid) from public;
grant execute on function private.can_manage_sucursal(uuid) to authenticated, service_role;

drop policy if exists plato_sucursal_insert_gestor on public.plato_sucursal;
create policy plato_sucursal_insert_gestor on public.plato_sucursal
  for insert to authenticated
  with check (private.can_manage_sucursal(sucursal_id));

drop policy if exists plato_sucursal_update_gestor on public.plato_sucursal;
create policy plato_sucursal_update_gestor on public.plato_sucursal
  for update to authenticated
  using (private.can_manage_sucursal(sucursal_id))
  with check (private.can_manage_sucursal(sucursal_id));

drop policy if exists plato_sucursal_delete_gestor on public.plato_sucursal;
create policy plato_sucursal_delete_gestor on public.plato_sucursal
  for delete to authenticated
  using (private.can_manage_sucursal(sucursal_id));
