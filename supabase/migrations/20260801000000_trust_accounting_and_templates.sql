-- =============================================================================
-- TRUST ACCOUNTING, LEASE ESCALATIONS, & DOCUMENT TEMPLATES SCHEMA
-- Migration: 20260801000000_trust_accounting_and_templates.sql
-- =============================================================================

-- 1. Create Enums for Trust Account Management
do $$ begin create type public.trust_account_type as enum ('section_86_2_general', 'section_86_4_investment'); exception when duplicate_object then null; end $$;
do $$ begin create type public.trust_transaction_type as enum ('deposit_inflow', 'refund_outflow', 'conveyancer_transfer', 'interest_credit', 'ppra_levy_deduction'); exception when duplicate_object then null; end $$;

-- 2. Trust Account Sub-Ledger Table
create table if not exists public.trust_account_ledger (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  deal_id uuid references public.deal(id) on delete set null,
  lease_id uuid references public.lease(id) on delete set null,
  account_type public.trust_account_type not null default 'section_86_2_general',
  transaction_type public.trust_transaction_type not null,
  amount_cents bigint not null,
  reference_number text not null,
  bank_statement_date date not null,
  payer_payee_name text not null,
  interest_split_client_pct numeric(5,2) default 95.00,
  interest_split_ppra_pct numeric(5,2) default 5.00,
  approved_by_principal uuid references public.user_account(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.trust_account_ledger enable row level security;

create policy "Trust ledger viewable by agency admins and principals" on public.trust_account_ledger
  for select using (
    agency_id = public.get_current_agency_id() 
    and public.get_current_role() in ('principal', 'admin')
  );

create policy "Trust ledger insertable by agency admins and principals" on public.trust_account_ledger
  for insert with check (
    agency_id = public.get_current_agency_id() 
    and public.get_current_role() in ('principal', 'admin')
  );

-- 3. Automated Lease Escalation Schedule
create table if not exists public.lease_escalation_schedule (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.lease(id) on delete cascade,
  effective_date date not null,
  escalation_percentage numeric(5,2) not null,
  previous_rent_cents bigint not null,
  new_rent_cents bigint not null,
  is_applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.lease_escalation_schedule enable row level security;

create policy "Escalation schedule viewable by agency" on public.lease_escalation_schedule
  for select using (
    exists (
      select 1 from public.lease l 
      where l.id = lease_id 
      and l.agency_id = public.get_current_agency_id()
    )
  );

create policy "Escalation schedule manageable by lease managers" on public.lease_escalation_schedule
  for all using (
    exists (
      select 1 from public.lease l 
      where l.id = lease_id 
      and l.agency_id = public.get_current_agency_id()
      and (l.managed_by = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'))
    )
  );

-- 4. Document Templates Table
create table if not exists public.document_template (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  name text not null,
  category public.document_category not null default 'other',
  body_markdown text not null,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_template enable row level security;

create policy "Document templates viewable by agency users" on public.document_template
  for select using (agency_id = public.get_current_agency_id());

create policy "Document templates manageable by agency principals and admins" on public.document_template
  for all using (
    agency_id = public.get_current_agency_id() 
    and public.get_current_role() in ('principal', 'admin')
  );
