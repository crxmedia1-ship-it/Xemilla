-- Lo que cada restaurante ya pagó a Xemilla. La propuesta sigue siendo la cotización.

create table if not exists public.restaurante_ventas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references public.restaurantes (id) on delete cascade,
  producto text not null check (
    producto in (
      'setup',
      'anual',
      'ar',
      'nutri',
      'tent',
      'nfc',
      'plate',
      'ia',
      'ia-mensual',
      'shop',
      'loyalty'
    )
  ),
  monto numeric(12, 2) not null check (monto > 0 and monto <= 100000000),
  moneda text not null check (moneda in ('usd', 'bs')),
  created_at timestamptz not null default now()
);

create index if not exists restaurante_ventas_restaurante_idx
  on public.restaurante_ventas (restaurante_id, created_at desc);

alter table public.restaurante_ventas enable row level security;

drop policy if exists restaurante_ventas_superadmin_all on public.restaurante_ventas;
create policy restaurante_ventas_superadmin_all
  on public.restaurante_ventas
  for all
  to authenticated
  using (private.is_superadmin())
  with check (private.is_superadmin());

revoke all on table public.restaurante_ventas from anon;
grant select, insert, update, delete on table public.restaurante_ventas to authenticated;
grant all on table public.restaurante_ventas to service_role;
