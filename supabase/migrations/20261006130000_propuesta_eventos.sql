-- Historial de cada propuesta: una fila por apertura o clic, con fecha.
-- Los contadores de public.propuestas siguen siendo el total rápido.

create table if not exists public.propuesta_eventos (
  id bigint generated always as identity primary key,
  propuesta_id uuid not null references public.propuestas (id) on delete cascade,
  tipo text not null check (tipo in ('vista', 'ar', 'nutri', 'qr', 'whatsapp')),
  created_at timestamptz not null default now()
);

create index if not exists propuesta_eventos_created_at_idx
  on public.propuesta_eventos (created_at desc);
create index if not exists propuesta_eventos_propuesta_id_idx
  on public.propuesta_eventos (propuesta_id);

alter table public.propuesta_eventos enable row level security;

drop policy if exists propuesta_eventos_superadmin_read on public.propuesta_eventos;
create policy propuesta_eventos_superadmin_read
  on public.propuesta_eventos
  for select
  to authenticated
  using (private.is_superadmin());

revoke all on table public.propuesta_eventos from anon;
grant select on table public.propuesta_eventos to authenticated;
grant all on table public.propuesta_eventos to service_role;

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

  if found then
    insert into public.propuesta_eventos (propuesta_id, tipo) values (pid, kind);
  end if;
end;
$$;

revoke all on function public.touch_propuesta(uuid, text) from public;
revoke all on function public.touch_propuesta(uuid, text) from anon, authenticated;
grant execute on function public.touch_propuesta(uuid, text) to service_role;
