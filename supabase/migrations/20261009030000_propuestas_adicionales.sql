-- Precios de los adicionales «Solo para degustadores», por propuesta.
-- Objeto { ar, nutri, qr, ia, shop, loyalty }. Vacío = «A consultar».

alter table public.propuestas
  add column if not exists adicionales jsonb not null default '{}'::jsonb;

alter table public.propuestas
  drop constraint if exists propuestas_adicionales_obj;

alter table public.propuestas
  add constraint propuestas_adicionales_obj
  check (jsonb_typeof(adicionales) = 'object');
