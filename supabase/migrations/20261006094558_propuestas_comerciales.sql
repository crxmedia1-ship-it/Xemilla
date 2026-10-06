-- Propuestas comerciales: el enlace de venta y lo que el cliente abrió.
-- Sin policy para anon: el precio no se lista por la API pública.
-- El conteo lo hace el servidor con service role (touch_propuesta).

create table if not exists public.propuestas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  logo_url text,
  setup text not null default '600' check (char_length(setup) between 1 and 12),
  dominio text,
  mundo text not null default 'estudio' check (mundo in ('barra', 'espacio', 'estudio')),
  vistas integer not null default 0 check (vistas >= 0),
  ultima_vista timestamptz,
  vio_ar integer not null default 0 check (vio_ar >= 0),
  vio_nutri integer not null default 0 check (vio_nutri >= 0),
  vio_qr integer not null default 0 check (vio_qr >= 0),
  vio_whatsapp integer not null default 0 check (vio_whatsapp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists propuestas_created_at_idx
  on public.propuestas (created_at desc);

alter table public.propuestas enable row level security;

drop policy if exists propuestas_superadmin_all on public.propuestas;
create policy propuestas_superadmin_all
  on public.propuestas
  for all
  to authenticated
  using (private.is_superadmin())
  with check (private.is_superadmin());

revoke all on table public.propuestas from anon;
grant select, insert, update, delete on table public.propuestas to authenticated;
grant all on table public.propuestas to service_role;

create or replace function public.touch_propuesta(pid uuid, kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if kind = 'vista' then
    update public.propuestas
      set vistas = vistas + 1,
          ultima_vista = now(),
          updated_at = now()
      where id = pid;
  elsif kind = 'ar' then
    update public.propuestas
      set vio_ar = vio_ar + 1, updated_at = now()
      where id = pid;
  elsif kind = 'nutri' then
    update public.propuestas
      set vio_nutri = vio_nutri + 1, updated_at = now()
      where id = pid;
  elsif kind = 'qr' then
    update public.propuestas
      set vio_qr = vio_qr + 1, updated_at = now()
      where id = pid;
  elsif kind = 'whatsapp' then
    update public.propuestas
      set vio_whatsapp = vio_whatsapp + 1, updated_at = now()
      where id = pid;
  else
    raise exception 'tipo de propuesta invalido';
  end if;
end;
$$;

revoke all on function public.touch_propuesta(uuid, text) from public;
revoke all on function public.touch_propuesta(uuid, text) from anon, authenticated;
grant execute on function public.touch_propuesta(uuid, text) to service_role;
