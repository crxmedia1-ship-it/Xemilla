-- Un solo juego de precios para «Solo para degustadores».
-- El SuperAdmin lo actualiza cuando regula un adicional; las propuestas nuevas lo reutilizan.

create table if not exists public.propuesta_precios_default (
  id text primary key default 'default' check (id = 'default'),
  adicionales jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint propuesta_precios_default_obj check (jsonb_typeof(adicionales) = 'object')
);

insert into public.propuesta_precios_default (id)
values ('default')
on conflict (id) do nothing;

alter table public.propuesta_precios_default enable row level security;

drop policy if exists propuesta_precios_default_superadmin on public.propuesta_precios_default;
create policy propuesta_precios_default_superadmin
  on public.propuesta_precios_default
  for all
  to authenticated
  using (private.is_superadmin())
  with check (private.is_superadmin());

revoke all on table public.propuesta_precios_default from anon;
grant select, insert, update on table public.propuesta_precios_default to authenticated;
grant all on table public.propuesta_precios_default to service_role;
