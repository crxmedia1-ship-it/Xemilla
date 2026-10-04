create index if not exists categorias_restaurante_orden_idx
  on public.categorias (restaurante_id, orden);

create index if not exists platos_restaurante_categoria_idx
  on public.platos (restaurante_id, categoria_id);

create index if not exists platos_categoria_idx
  on public.platos (categoria_id);

create index if not exists plato_vistas_restaurante_created_idx
  on public.plato_vistas (restaurante_id, created_at);

create index if not exists plato_vistas_plato_idx
  on public.plato_vistas (plato_id);
