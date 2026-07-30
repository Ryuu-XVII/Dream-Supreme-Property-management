-- 1. Bond Application Tracking (Phase 3C)
create table if not exists public.bond_application (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  institution text not null,
  originator text,
  amount_cents bigint not null,
  status text not null default 'submitted' check (status in ('submitted', 'aip', 'granted', 'declined')),
  applied_on date not null default current_date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.bond_application enable row level security;

create policy "Users can view bond applications for their agency" on public.bond_application
for select using (
  exists (
    select 1 from public.deal d
    join public.user_account u on d.agency_id = u.agency_id
    where d.id = bond_application.deal_id
    and u.id = auth.uid()
  )
);

create policy "Users can insert bond applications for their agency" on public.bond_application
for insert with check (
  exists (
    select 1 from public.deal d
    join public.user_account u on d.agency_id = u.agency_id
    where d.id = deal_id
    and u.id = auth.uid()
  )
);

create policy "Users can update bond applications for their agency" on public.bond_application
for update using (
  exists (
    select 1 from public.deal d
    join public.user_account u on d.agency_id = u.agency_id
    where d.id = bond_application.deal_id
    and u.id = auth.uid()
  )
);

create policy "Users can delete bond applications for their agency" on public.bond_application
for delete using (
  exists (
    select 1 from public.deal d
    join public.user_account u on d.agency_id = u.agency_id
    where d.id = bond_application.deal_id
    and u.id = auth.uid()
  )
);

-- 2. Audit Log Generic RPC (Phase 3B)
create or replace function log_audit_event(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_summary text,
  p_after_json jsonb default null
) returns void
language plpgsql
security definer
as $$
declare
  v_agency_id uuid;
begin
  select agency_id into v_agency_id from public.user_account where id = auth.uid();
  if v_agency_id is null then
    raise exception 'Not authorized';
  end if;

  insert into public.audit_log(
    agency_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    after_json
  ) values (
    v_agency_id,
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_action,
    jsonb_build_object('summary', p_summary) || coalesce(p_after_json, '{}'::jsonb)
  );
end;
$$;
