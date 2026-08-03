-- =============================================================================
-- MODULE 5: NEXT-GEN ENTERPRISE ERP SCHEMA
-- Migration: 20260803000008_nextgen_erp_schema.sql
-- WhatsApp Gateway, OFX Bank Statement Import, Maintenance ERP, Webhook Log, EFT Batches
-- =============================================================================

-- 1. WhatsApp Message Log Table
create table if not exists public.whatsapp_message_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  recipient_phone text not null,
  template_name text not null,
  payload jsonb,
  status text not null check (status in ('queued', 'sent', 'delivered', 'read', 'failed')) default 'queued',
  provider_message_id text,
  sent_at timestamptz not null default now()
);

alter table public.whatsapp_message_log enable row level security;

create policy "WhatsApp log viewable by agency" on public.whatsapp_message_log
  for select using (agency_id = public.get_current_agency_id());

create policy "WhatsApp log insertable by agency users" on public.whatsapp_message_log
  for insert with check (agency_id = public.get_current_agency_id());

-- 2. Bank Statement OFX Import & Matching Table
create table if not exists public.bank_statement_import (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  file_name text not null,
  statement_date date not null default current_date,
  total_transactions integer not null default 0,
  imported_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.bank_statement_import enable row level security;

create policy "Bank statement import viewable by agency" on public.bank_statement_import
  for select using (agency_id = public.get_current_agency_id());

create policy "Bank statement import manageable by agency admins" on public.bank_statement_import
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 3. Maintenance Ticket & Work Order ERP Table
create table if not exists public.maintenance_ticket (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  lease_id uuid not null references public.lease(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete cascade,
  title text not null,
  category text not null check (category in ('plumbing', 'electrical', 'structural', 'appliance', 'general')),
  severity text not null check (severity in ('low', 'medium', 'high', 'emergency')) default 'medium',
  status text not null check (status in ('open', 'quote_requested', 'approved', 'in_progress', 'completed', 'cancelled')) default 'open',
  contractor_name text,
  quoted_amount_cents bigint default 0,
  approved_by uuid references public.user_account(id) on delete set null,
  deduct_from_landlord boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.maintenance_ticket enable row level security;

create policy "Maintenance tickets viewable by agency" on public.maintenance_ticket
  for select using (agency_id = public.get_current_agency_id());

create policy "Maintenance tickets manageable by agency users" on public.maintenance_ticket
  for all using (agency_id = public.get_current_agency_id());

-- 4. Portal Webhook Ingestion Log Table
create table if not exists public.portal_lead_webhook_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  portal_source text not null,
  payload jsonb not null,
  status text not null check (status in ('processed', 'failed')) default 'processed',
  error_message text,
  received_at timestamptz not null default now()
);

alter table public.portal_lead_webhook_log enable row level security;

create policy "Portal webhook log viewable by agency admins" on public.portal_lead_webhook_log
  for select using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 5. EFT / ACB Commission Payout Batch Table
create table if not exists public.eft_payout_batch (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  batch_number text not null,
  total_amount_cents bigint not null,
  payout_count integer not null,
  status text not null check (status in ('pending', 'exported', 'reconciled')) default 'pending',
  created_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.eft_payout_batch enable row level security;

create policy "EFT payout batches viewable by agency" on public.eft_payout_batch
  for select using (agency_id = public.get_current_agency_id());

create policy "EFT payout batches manageable by agency admins" on public.eft_payout_batch
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 6. RPC Procedure to Approve Maintenance Work Order & Deduct from Trust Ledger
create or replace function public.approve_maintenance_work_order(
  p_ticket_id uuid,
  p_contractor_amount_cents bigint
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_lease_id uuid;
begin
  select m.lease_id into v_lease_id
  from public.maintenance_ticket m
  where m.id = p_ticket_id and m.agency_id = v_agency_id;

  if v_lease_id is null then
    raise exception 'Maintenance ticket not found.';
  end if;

  update public.maintenance_ticket
  set status = 'approved',
      quoted_amount_cents = p_contractor_amount_cents,
      approved_by = v_actor_id
  where id = p_ticket_id and agency_id = v_agency_id;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'status', 'approved',
    'quoted_amount_cents', p_contractor_amount_cents
  );
end;
$$;
