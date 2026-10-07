-- Un plato destacado puede salir como «Sugerencia del Chef» o como «Promoción».
-- Ambos comparten el mismo carrusel de la WebApp; solo cambia la etiqueta.

alter table public.platos
  add column if not exists destacado_tipo text not null default 'chef';

alter table public.platos
  drop constraint if exists platos_destacado_tipo_check;
alter table public.platos
  add constraint platos_destacado_tipo_check
  check (destacado_tipo in ('chef', 'promocion'));

comment on column public.platos.destacado_tipo is
  'Etiqueta del destacado: chef (Sugerencia del Chef) | promocion (Promoción). Solo aplica si destacado = true.';
