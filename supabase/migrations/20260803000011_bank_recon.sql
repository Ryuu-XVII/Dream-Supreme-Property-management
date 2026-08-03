-- Add payment_reference to lease table

alter table public.lease
add column if not exists payment_reference text;

create index if not exists idx_lease_payment_ref on public.lease(payment_reference);
