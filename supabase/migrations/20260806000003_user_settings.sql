create table if not exists public.user_setting (
  user_id uuid primary key references public.user_account(id) on delete cascade,
  default_commission_rate_bps integer not null default 500 check (default_commission_rate_bps between 0 and 10000),
  default_conveyancer_firm_id uuid references public.conveyancer_firm(id) on delete set null,
  mandate_target integer not null default 0 check (mandate_target >= 0),
  sales_target_cents bigint not null default 0 check (sales_target_cents >= 0),
  gci_target_cents bigint not null default 0 check (gci_target_cents >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_setting enable row level security;

create policy "Users read their own settings" on public.user_setting
  for select using (user_id = public.get_current_user_account_id());

create policy "Users insert their own settings" on public.user_setting
  for insert with check (user_id = public.get_current_user_account_id());

create policy "Users update their own settings" on public.user_setting
  for update using (user_id = public.get_current_user_account_id())
  with check (user_id = public.get_current_user_account_id());

grant select, insert, update on public.user_setting to authenticated;

create or replace function public.get_current_transfer_duty_brackets()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select brackets_json
      from public.config_transfer_duty
      where effective_from <= current_date
      order by effective_from desc
      limit 1
    ),
    '[]'::jsonb
  );
$$;

revoke all on function public.get_current_transfer_duty_brackets() from public;
grant execute on function public.get_current_transfer_duty_brackets() to anon, authenticated;
