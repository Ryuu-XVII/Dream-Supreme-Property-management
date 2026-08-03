-- =============================================================================
-- MODULE 3: FINANCIAL ENGINE & COMMISSION MANAGEMENT SCHEMA
-- Migration: 20260803000006_financial_engine_and_cda_schema.sql
-- Tiered Commission Rules, CDA Instructions, Trust Reconciliation & GL Sync Logs
-- =============================================================================

-- 1. Commission Tier Sliding Scale Rules Table
create table if not exists public.commission_tier_rule (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  rule_name text not null,
  min_volume_cents bigint not null default 0,
  max_volume_cents bigint,
  agent_split_pct numeric(5,2) not null check (agent_split_pct between 0 and 100),
  franchise_fee_pct numeric(5,2) not null default 0.00 check (franchise_fee_pct between 0 and 100),
  desk_fee_cents bigint not null default 0,
  team_lead_override_pct numeric(5,2) not null default 0.00 check (team_lead_override_pct between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.commission_tier_rule enable row level security;

create policy "Commission rules viewable by agency" on public.commission_tier_rule
  for select using (agency_id = public.get_current_agency_id());

create policy "Commission rules manageable by agency admins" on public.commission_tier_rule
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 2. Commission Disbursement Authorization (CDA) Table
create table if not exists public.commission_disbursement_instruction (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  deal_id uuid not null references public.deal(id) on delete cascade,
  conveyancer_firm_name text not null,
  conveyancer_email text,
  gross_commission_cents bigint not null,
  vat_cents bigint not null,
  net_agency_cents bigint not null,
  agent_payout_cents bigint not null,
  team_lead_override_cents bigint default 0,
  cda_status text not null check (cda_status in ('draft', 'issued', 'paid', 'cancelled')) default 'draft',
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.commission_disbursement_instruction enable row level security;

create policy "CDA viewable by agency" on public.commission_disbursement_instruction
  for select using (agency_id = public.get_current_agency_id());

create policy "CDA manageable by principals and admins" on public.commission_disbursement_instruction
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 3. General Ledger Accounting Sync Log Table
create table if not exists public.accounting_sync_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  platform text not null check (platform in ('xero', 'quickbooks', 'sage')),
  entity_type text not null,
  entity_id uuid not null,
  sync_status text not null check (sync_status in ('success', 'failed', 'pending')),
  payload jsonb,
  error_message text,
  synced_at timestamptz not null default now()
);

alter table public.accounting_sync_log enable row level security;

create policy "GL sync log viewable by agency admins" on public.accounting_sync_log
  for select using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

create policy "GL sync log insertable by agency admins" on public.accounting_sync_log
  for insert with check (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 4. Tiered Commission Calculation RPC Procedure
create or replace function public.calculate_tiered_commission_splits(
  p_deal_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_purchase_price bigint;
  v_vat_rate numeric := 0.15;
  v_gross_commission bigint;
  v_vat_cents bigint;
  v_net_commission bigint;
  v_agent_split_pct numeric := 50.00;
  v_franchise_fee_pct numeric := 0.00;
  v_desk_fee_cents bigint := 0;
  v_agent_payout bigint;
  v_agency_retention bigint;
begin
  select d.purchase_price_cents
  into v_purchase_price
  from public.deal d
  where d.id = p_deal_id and d.agency_id = v_agency_id;

  if v_purchase_price is null then
    raise exception 'Deal not found or invalid agency session.';
  end if;

  -- Default 5% gross commission rule
  v_gross_commission := (v_purchase_price * 0.05)::bigint;
  v_vat_cents := (v_gross_commission * v_vat_rate)::bigint;
  v_net_commission := v_gross_commission - v_vat_cents;

  -- Fetch matching sliding scale tier
  select r.agent_split_pct, r.franchise_fee_pct, r.desk_fee_cents
  into v_agent_split_pct, v_franchise_fee_pct, v_desk_fee_cents
  from public.commission_tier_rule r
  where r.agency_id = v_agency_id
    and v_purchase_price >= r.min_volume_cents
    and (r.max_volume_cents is null or v_purchase_price <= r.max_volume_cents)
  limit 1;

  v_agent_payout := ((v_net_commission * v_agent_split_pct / 100.0) - v_desk_fee_cents)::bigint;
  if v_agent_payout < 0 then
    v_agent_payout := 0;
  end if;
  v_agency_retention := v_net_commission - v_agent_payout;

  return jsonb_build_object(
    'deal_id', p_deal_id,
    'gross_commission_cents', v_gross_commission,
    'vat_cents', v_vat_cents,
    'net_commission_cents', v_net_commission,
    'agent_split_pct', v_agent_split_pct,
    'agent_payout_cents', v_agent_payout,
    'agency_retention_cents', v_agency_retention
  );
end;
$$;
