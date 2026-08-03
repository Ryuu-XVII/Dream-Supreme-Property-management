-- =============================================================================
-- RENTALS SCHEMA (RELEASE 2)
-- Migration: 20260730000003_rentals_schema.sql
-- =============================================================================

-- 1. Create Enums
do $$ begin create type public.lease_status as enum ('active', 'expired', 'cancelled', 'eviction'); exception when duplicate_object then null; end $$;
do $$ begin create type public.invoice_status as enum ('draft', 'issued', 'paid', 'overdue', 'void'); exception when duplicate_object then null; end $$;
do $$ begin create type public.inspection_type as enum ('in-going', 'interim', 'out-going'); exception when duplicate_object then null; end $$;
do $$ begin create type public.maintenance_status as enum ('reported', 'quoted', 'approved', 'in_progress', 'completed', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.deposit_entry_type as enum ('inflow', 'outflow', 'interest'); exception when duplicate_object then null; end $$;
do $$ begin create type public.deposit_holder as enum ('agency_trust', 'landlord', 'deposit_scheme'); exception when duplicate_object then null; end $$;

-- 2. Create Tables

-- LEASE
create table if not exists public.lease (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  property_id uuid not null references public.property(id) on delete restrict,
  landlord_party_id uuid not null references public.party(id) on delete restrict,
  tenant_party_id uuid not null references public.party(id) on delete restrict,
  managed_by uuid references public.user_account(id) on delete set null,
  start_on date not null,
  end_on date not null,
  monthly_rent_cents bigint not null default 0,
  escalation_rate_bps int not null default 0,
  escalation_month smallint check (escalation_month between 1 and 12),
  deposit_cents bigint not null default 0,
  deposit_held_by public.deposit_holder not null default 'agency_trust',
  procurement_fee_cents bigint not null default 0,
  management_fee_bps int not null default 0,
  status public.lease_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_lease_agency on public.lease(agency_id);
create index idx_lease_property on public.lease(property_id);
create index idx_lease_landlord on public.lease(landlord_party_id);
create index idx_lease_tenant on public.lease(tenant_party_id);

-- LEASE INVOICE
create table if not exists public.lease_invoice (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.lease(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  rent_cents bigint not null default 0,
  other_charges_cents bigint not null default 0,
  total_cents bigint not null default 0,
  due_on date not null,
  paid_cents bigint not null default 0,
  paid_on date,
  status public.invoice_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_invoice_lease on public.lease_invoice(lease_id);

-- DEPOSIT LEDGER
create table if not exists public.deposit_ledger (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.lease(id) on delete cascade,
  entry_type public.deposit_entry_type not null,
  amount_cents bigint not null default 0,
  interest_cents bigint not null default 0,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_deposit_ledger_lease on public.deposit_ledger(lease_id);

-- INSPECTION
create table if not exists public.inspection (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.lease(id) on delete cascade,
  inspection_type public.inspection_type not null,
  conducted_on date not null,
  conducted_by uuid references public.user_account(id) on delete set null,
  findings_json jsonb,
  document_id uuid references public.document(id) on delete set null,
  tenant_signature_id uuid, -- Reference to a signature or document
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_inspection_lease on public.inspection(lease_id);

-- MAINTENANCE JOB
create table if not exists public.maintenance_job (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.lease(id) on delete cascade,
  reported_on date not null,
  description text not null,
  priority text,
  contractor_name text,
  quoted_cents bigint,
  approved_by uuid references public.user_account(id) on delete set null,
  approved_on date,
  completed_on date,
  status public.maintenance_status not null default 'reported',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maintenance_lease on public.maintenance_job(lease_id);

-- LANDLORD STATEMENT
create table if not exists public.landlord_statement (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.lease(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  rent_collected_cents bigint not null default 0,
  management_fee_cents bigint not null default 0,
  deductions_cents bigint not null default 0,
  net_payout_cents bigint not null default 0,
  document_id uuid references public.document(id) on delete set null,
  generated_on timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_landlord_statement_lease on public.landlord_statement(lease_id);

-- 3. Row-Level Security (RLS)
alter table public.lease enable row level security;
alter table public.lease_invoice enable row level security;
alter table public.deposit_ledger enable row level security;
alter table public.inspection enable row level security;
alter table public.maintenance_job enable row level security;
alter table public.landlord_statement enable row level security;

-- Function to check lease update access
create or replace function public.can_edit_lease(p_lease_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.lease l
    where l.id = p_lease_id
      and l.agency_id = public.get_current_agency_id()
      and (l.managed_by = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'))
  );
$$;

-- LEASE POLICIES
create policy "Leases are readable by agency" on public.lease for select
using (agency_id = public.get_current_agency_id());

create policy "Users can insert leases for their agency" on public.lease for insert
with check (agency_id = public.get_current_agency_id() and managed_by = public.get_current_user_account_id());

create policy "Lease managers can update their leases" on public.lease for update
using (public.can_edit_lease(id))
with check (agency_id = public.get_current_agency_id());

-- CHILD TABLE POLICIES (Read for agency, Write for lease manager)
-- lease_invoice
create policy "Invoices are readable by agency" on public.lease_invoice for select
using (exists (select 1 from public.lease l where l.id = lease_id and l.agency_id = public.get_current_agency_id()));

create policy "Lease managers can manage invoices" on public.lease_invoice for all
using (public.can_edit_lease(lease_id))
with check (public.can_edit_lease(lease_id));

-- deposit_ledger
create policy "Ledger is readable by agency" on public.deposit_ledger for select
using (exists (select 1 from public.lease l where l.id = lease_id and l.agency_id = public.get_current_agency_id()));

create policy "Lease managers can manage ledger" on public.deposit_ledger for all
using (public.can_edit_lease(lease_id))
with check (public.can_edit_lease(lease_id));

-- inspection
create policy "Inspections are readable by agency" on public.inspection for select
using (exists (select 1 from public.lease l where l.id = lease_id and l.agency_id = public.get_current_agency_id()));

create policy "Lease managers can manage inspections" on public.inspection for all
using (public.can_edit_lease(lease_id))
with check (public.can_edit_lease(lease_id));

-- maintenance_job
create policy "Maintenance is readable by agency" on public.maintenance_job for select
using (exists (select 1 from public.lease l where l.id = lease_id and l.agency_id = public.get_current_agency_id()));

create policy "Lease managers can manage maintenance" on public.maintenance_job for all
using (public.can_edit_lease(lease_id))
with check (public.can_edit_lease(lease_id));

-- landlord_statement
create policy "Statements are readable by agency" on public.landlord_statement for select
using (exists (select 1 from public.lease l where l.id = lease_id and l.agency_id = public.get_current_agency_id()));

create policy "Lease managers can manage statements" on public.landlord_statement for all
using (public.can_edit_lease(lease_id))
with check (public.can_edit_lease(lease_id));
