-- =============================================================================
-- MODULE 1: TRANSACTION MANAGEMENT & LEGAL COMPLIANCE SCHEMA
-- Migration: 20260803000004_transaction_and_esign_schema.sql
-- Smart Form Field Loops, E-Sign Envelope Audits, Compliance Queue, Contingency Tracking
-- =============================================================================

-- 1. Smart Form Document Field Mapping Table
create table if not exists public.document_field_token (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  token_key text not null,
  source_table text not null,
  source_column text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(agency_id, token_key)
);

alter table public.document_field_token enable row level security;

create policy "Field tokens viewable by agency users" on public.document_field_token
  for select using (agency_id = public.get_current_agency_id());

create policy "Field tokens manageable by agency admins" on public.document_field_token
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 2. E-Sign Envelope & Tamper-Evident Audit Trail Tables
create table if not exists public.esign_envelope (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  deal_id uuid references public.deal(id) on delete set null,
  document_id uuid references public.document(id) on delete cascade,
  status text not null check (status in ('draft', 'sent', 'partially_signed', 'completed', 'declined')) default 'draft',
  payload_sha256 text not null,
  created_by uuid references public.user_account(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.esign_envelope enable row level security;

create policy "Envelopes viewable by agency" on public.esign_envelope
  for select using (agency_id = public.get_current_agency_id());

create policy "Envelopes manageable by agency users" on public.esign_envelope
  for all using (agency_id = public.get_current_agency_id());

create table if not exists public.esign_audit_log (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.esign_envelope(id) on delete cascade,
  recipient_email text not null,
  signer_role text not null,
  action text not null check (action in ('sent', 'viewed', 'signed', 'declined')),
  ip_address inet,
  user_agent text,
  signature_svg text,
  occurred_at timestamptz not null default now()
);

alter table public.esign_audit_log enable row level security;

create policy "Esign audit log viewable by agency" on public.esign_audit_log
  for select using (
    exists (
      select 1 from public.esign_envelope e
      where e.id = esign_audit_log.envelope_id
        and e.agency_id = public.get_current_agency_id()
    )
  );

create policy "Esign audit log insertable by authenticated users" on public.esign_audit_log
  for insert with check (
    exists (
      select 1 from public.esign_envelope e
      where e.id = esign_audit_log.envelope_id
        and e.agency_id = public.get_current_agency_id()
    )
  );

-- 3. Compliance Review & Brokerage Auditing Queue
create table if not exists public.compliance_review_queue (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  deal_id uuid not null references public.deal(id) on delete cascade,
  checklist_item text not null,
  is_mandatory boolean not null default true,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  reviewed_by uuid references public.user_account(id) on delete set null,
  rejection_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.compliance_review_queue enable row level security;

create policy "Compliance review viewable by agency" on public.compliance_review_queue
  for select using (agency_id = public.get_current_agency_id());

create policy "Compliance review manageable by principals and admins" on public.compliance_review_queue
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 4. Contingency & Milestone Deadline Tracker
create table if not exists public.deal_contingency_tracker (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  deal_id uuid not null references public.deal(id) on delete cascade,
  contingency_type text not null,
  due_date date not null,
  status text not null check (status in ('pending', 'fulfilled', 'lapsed', 'extended')) default 'pending',
  fulfilled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.deal_contingency_tracker enable row level security;

create policy "Contingency tracker viewable by agency" on public.deal_contingency_tracker
  for select using (agency_id = public.get_current_agency_id());

create policy "Contingency tracker manageable by agency users" on public.deal_contingency_tracker
  for all using (agency_id = public.get_current_agency_id());

-- 5. RPC Procedure to Review Compliance Items
create or replace function public.review_compliance_item(
  p_checklist_id uuid,
  p_status text,
  p_rejection_notes text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_role public.user_role := public.get_current_role();
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active authenticated session is required.';
  end if;

  if v_role not in ('principal', 'admin') then
    raise exception 'Only an agency principal or administrator can perform compliance reviews.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Status must be approved or rejected.';
  end if;

  update public.compliance_review_queue
  set status = p_status,
      rejection_notes = p_rejection_notes,
      reviewed_by = v_actor_id,
      reviewed_at = now()
  where id = p_checklist_id and agency_id = v_agency_id;

  return jsonb_build_object('success', true, 'checklist_id', p_checklist_id, 'status', p_status);
end;
$$;
