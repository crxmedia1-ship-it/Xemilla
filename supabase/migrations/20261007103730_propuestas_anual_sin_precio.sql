-- Licencia anual editable por propuesta y opción de mostrar los precios como «A consultar».

alter table public.propuestas
  add column if not exists anual text not null default '200'
    check (char_length(anual) between 1 and 12),
  add column if not exists sin_precio boolean not null default false;
