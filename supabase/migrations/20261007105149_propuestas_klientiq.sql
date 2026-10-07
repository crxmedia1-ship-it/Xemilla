-- Adicional Klientiq (CRM + asistente IA): contador y evento propios en las métricas de propuestas.

alter table public.propuestas
  add column if not exists vio_ia integer not null default 0 check (vio_ia >= 0);

alter table public.propuesta_eventos
  drop constraint if exists propuesta_eventos_tipo_check;
alter table public.propuesta_eventos
  add constraint propuesta_eventos_tipo_check
  check (tipo in ('vista', 'ar', 'nutri', 'qr', 'ia', 'whatsapp'));

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
  elsif kind = 'ia' then
    update public.propuestas
      set vio_ia = vio_ia + 1, updated_at = now()
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
