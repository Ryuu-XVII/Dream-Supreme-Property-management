-- =============================================================================
-- MANDATE PLATFORM INITIAL SCHEMA & RLS MIGRATION (Idempotent)
-- Migration: 20260729000000_init_mandate_schema.sql
-- =============================================================================

-- ─── 001 EXTENSIONS ────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists "pgcrypto" schema extensions;
create extension if not exists "moddatetime" schema extensions;

-- ─── 002 ENUMS (Safe creation) ─────────────────────────────────────────────
do $$ begin create type public.user_role as enum ('principal', 'agent', 'candidate', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.user_status as enum ('active', 'suspended', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.deal_type as enum ('sale', 'rental'); exception when duplicate_object then null; end $$;
do $$ begin create type public.deal_status as enum ('active', 'registered', 'cancelled', 'lapsed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.deal_stage as enum (
  'mandate_signed', 'listed_marketing', 'offer_received', 'otp_signed',
  'suspensive_conditions_pending', 'conveyancer_instructed', 'compliance_certificates',
  'transfer_duty_vat', 'rates_levy_clearance', 'documents_signed_guarantees',
  'lodged', 'registered', 'commission_released'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.mandate_type as enum ('sole', 'joint', 'open'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mandate_status as enum ('active', 'expired', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.party_type as enum ('seller', 'purchaser', 'landlord', 'tenant', 'referrer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.entity_type as enum ('natural_person', 'company', 'close_corporation', 'trust', 'deceased_estate'); exception when duplicate_object then null; end $$;
do $$ begin create type public.fica_status as enum ('not_started', 'partial', 'complete', 'expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.condition_type as enum ('bond_approval', 'sale_of_property', 'fica_clearance', 'due_diligence', 'body_corporate_consent', 'subdivision_rezoning', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.condition_status as enum ('pending', 'fulfilled', 'waived', 'failed', 'extended'); exception when duplicate_object then null; end $$;
do $$ begin create type public.bond_app_status as enum ('not_applied', 'submitted', 'declined', 'approved_in_principle', 'formally_granted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'countered'); exception when duplicate_object then null; end $$;
do $$ begin create type public.participant_role as enum ('listing_agent', 'selling_agent', 'co_agent', 'referrer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.split_type as enum ('percentage', 'fixed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.commission_calc_status as enum ('provisional', 'confirmed', 'reversed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.commission_line_type as enum ('franchise_fee', 'referral_fee', 'marketing_recovery', 'comandate_share', 'office_share', 'desk_fee'); exception when duplicate_object then null; end $$;
do $$ begin create type public.vat_treatment as enum ('inclusive', 'exclusive', 'not_applicable'); exception when duplicate_object then null; end $$;
do $$ begin create type public.advance_status as enum ('outstanding', 'partially_recovered', 'fully_recovered'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_channel as enum ('email', 'in_app', 'whatsapp_link'); exception when duplicate_object then null; end $$;
do $$ begin create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'closed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.document_category as enum ('mandate', 'otp', 'fica_id', 'fica_proof_of_address', 'fica_bank_statement', 'title_deed', 'municipal_account', 'levy_clearance', 'body_corporate_consent', 'bond_grant_letter', 'spousal_consent', 'compliance_electrical', 'compliance_beetle', 'compliance_gas', 'compliance_plumbing', 'compliance_electric_fence', 'ffc_certificate', 'commission_statement', 'template', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.audit_action as enum ('create', 'update', 'delete', 'stage_transition', 'calculation', 'login', 'export'); exception when duplicate_object then null; end $$;
do $$ begin create type public.property_type as enum ('house', 'townhouse', 'apartment', 'vacant_land', 'farm', 'commercial', 'industrial', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cancellation_reason as enum ('bond_declined', 'bond_not_applied_in_time', 'sale_of_purchasers_property_failed', 'purchaser_withdrew', 'seller_withdrew', 'property_defect', 'compliance_certificate_failure', 'price_renegotiation_failed', 'purchaser_death_or_insolvency', 'seller_death_or_insolvency', 'deceased_estate_or_trust_complication', 'title_or_boundary_defect', 'municipal_or_clearance_obstruction', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.rounding_mode as enum ('half_up', 'half_down', 'bankers'); exception when duplicate_object then null; end $$;

-- ─── 003 CORE TABLES ───────────────────────────────────────────────────────
create table if not exists public.agency (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  ppra_reference text,
  vat_number text,
  is_vat_vendor boolean not null default false,
  address text,
  logo_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.branch (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.user_account (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  agency_id uuid not null references public.agency(id) on delete restrict,
  branch_id uuid references public.branch(id) on delete set null,
  full_name text not null,
  email text not null,
  mobile text,
  role public.user_role not null default 'agent',
  status public.user_status not null default 'active',
  ppra_reference text,
  is_candidate boolean not null default false,
  supervisor_id uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.ffc_certificate (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references public.user_account(id) on delete restrict,
  certificate_number text not null,
  issued_on date not null,
  expires_on date not null,
  document_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.property (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  address_line text not null,
  suburb text,
  city text,
  province text,
  postal_code text,
  erf_number text,
  title_deed_number text,
  property_type public.property_type not null default 'house',
  is_sectional_title boolean not null default false,
  bedrooms smallint,
  bathrooms smallint,
  garages smallint,
  erf_size_sqm numeric(12,2),
  floor_size_sqm numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.party (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  party_type public.party_type not null,
  entity_type public.entity_type not null default 'natural_person',
  full_name text not null,
  id_or_reg_number text,
  email text,
  mobile text,
  marital_status text,
  is_vat_vendor boolean not null default false,
  fica_status public.fica_status not null default 'not_started',
  fica_completed_on date,
  popia_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.mandate (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  property_id uuid not null references public.property(id) on delete restrict,
  mandate_type public.mandate_type not null default 'sole',
  listing_price_cents bigint not null default 0,
  commission_rate_bps int not null default 0,
  signed_on date,
  expires_on date,
  document_id uuid,
  status public.mandate_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conveyancer_firm (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  name text not null,
  contact_name text,
  email text,
  telephone text,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- ─── 004 DEAL PIPELINE TABLES ──────────────────────────────────────────────
create table if not exists public.deal (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  branch_id uuid references public.branch(id) on delete set null,
  property_id uuid not null references public.property(id) on delete restrict,
  mandate_id uuid references public.mandate(id) on delete set null,
  deal_type public.deal_type not null default 'sale',
  reference text not null,
  stage public.deal_stage not null default 'mandate_signed',
  status public.deal_status not null default 'active',
  sale_price_cents bigint not null default 0,
  otp_signed_on date,
  occupation_date date,
  transfer_date date,
  registration_date date,
  conveyancer_firm_id uuid references public.conveyancer_firm(id) on delete set null,
  conveyancer_reference text,
  is_vat_sale boolean not null default false,
  cancellation_reason public.cancellation_reason,
  cancellation_notes text,
  cancelled_on date,
  created_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.deal_participant (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  user_account_id uuid references public.user_account(id) on delete set null,
  external_agency_name text,
  role public.participant_role not null default 'listing_agent',
  split_type public.split_type not null default 'percentage',
  split_value int not null default 0,
  is_external boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  from_stage public.deal_stage,
  to_stage public.deal_stage not null,
  changed_by uuid references public.user_account(id) on delete set null,
  changed_by_external_email text,
  reason text,
  is_override boolean not null default false,
  occurred_at timestamptz not null default now()
);

create table if not exists public.deal_party (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  party_id uuid not null references public.party(id) on delete restrict,
  role public.party_type not null,
  created_at timestamptz not null default now(),
  unique(deal_id, party_id, role)
);

create table if not exists public.suspensive_condition (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  condition_type public.condition_type not null,
  description text,
  due_on date not null,
  original_due_on date not null,
  responsible_party text,
  status public.condition_status not null default 'pending',
  fulfilled_on date,
  extension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bond_application (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  institution text not null,
  originator text,
  applied_on date,
  status public.bond_app_status not null default 'not_applied',
  approved_amount_cents bigint,
  status_updated_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  property_id uuid not null references public.property(id) on delete restrict,
  purchaser_party_id uuid references public.party(id) on delete set null,
  offer_price_cents bigint not null default 0,
  deposit_cents bigint not null default 0,
  bond_amount_cents bigint not null default 0,
  expires_on date,
  status public.offer_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_item (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  category text not null,
  label text not null,
  is_required boolean not null default true,
  is_complete boolean not null default false,
  document_id uuid,
  completed_on date,
  completed_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── 005 COMMISSION ENGINE TABLES ──────────────────────────────────────────
create table if not exists public.commission_rule_set (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  name text not null,
  effective_from date not null,
  effective_to date,
  is_default boolean not null default false,
  vat_treatment public.vat_treatment not null default 'inclusive',
  default_commission_rate_bps int not null default 500,
  franchise_fee_bps int not null default 0,
  office_share_bps int not null default 5000,
  rounding_mode public.rounding_mode not null default 'half_up',
  created_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_rule_line (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.commission_rule_set(id) on delete cascade,
  sequence int not null,
  line_type public.commission_line_type not null,
  calculation_basis text,
  rate_bps int not null default 0,
  fixed_amount_cents bigint not null default 0,
  payee_type text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.commission_calculation (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete restrict,
  rule_set_id uuid not null references public.commission_rule_set(id) on delete restrict,
  calculated_at timestamptz not null default now(),
  calculated_by uuid references public.user_account(id) on delete set null,
  gross_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  net_cents bigint not null default 0,
  distributable_pool_cents bigint not null default 0,
  office_share_cents bigint not null default 0,
  agent_pool_cents bigint not null default 0,
  input_snapshot_json jsonb not null default '{}'::jsonb,
  status public.commission_calc_status not null default 'provisional',
  created_at timestamptz not null default now()
);

create table if not exists public.commission_allocation (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.commission_calculation(id) on delete cascade,
  user_account_id uuid references public.user_account(id) on delete set null,
  external_payee_name text,
  allocation_type text,
  gross_allocation_cents bigint not null default 0,
  desk_fee_cents bigint not null default 0,
  advance_recovery_cents bigint not null default 0,
  net_payable_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.commission_advance (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  user_account_id uuid not null references public.user_account(id) on delete restrict,
  deal_id uuid references public.deal(id) on delete set null,
  amount_cents bigint not null default 0,
  advanced_on date not null,
  recovered_cents bigint not null default 0,
  status public.advance_status not null default 'outstanding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commission_clawback (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.commission_calculation(id) on delete restrict,
  user_account_id uuid not null references public.user_account(id) on delete restrict,
  amount_cents bigint not null default 0,
  reason text,
  raised_on date not null,
  recovered_on date,
  created_at timestamptz not null default now()
);

-- ─── 006 DOCUMENTS ─────────────────────────────────────────────────────────
create table if not exists public.document (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  deal_id uuid references public.deal(id) on delete set null,
  party_id uuid references public.party(id) on delete set null,
  user_account_id uuid references public.user_account(id) on delete set null,
  category public.document_category not null default 'other',
  filename text not null,
  storage_key text not null,
  mime_type text,
  size_bytes bigint,
  version int not null default 1,
  supersedes_id uuid references public.document(id) on delete set null,
  uploaded_by uuid references public.user_account(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.signature_record (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document(id) on delete restrict,
  signer_party_id uuid references public.party(id) on delete set null,
  signer_email text not null,
  signature_image_key text,
  otp_verified_at timestamptz,
  ip_address inet,
  user_agent text,
  document_hash text not null,
  signed_at timestamptz not null default now()
);

do $$ begin
  alter table public.ffc_certificate add constraint fk_ffc_document foreign key (document_id) references public.document(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.checklist_item add constraint fk_checklist_document foreign key (document_id) references public.document(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.mandate add constraint fk_mandate_document foreign key (document_id) references public.document(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ─── 007 SUPPORTING TABLES ─────────────────────────────────────────────────
create table if not exists public.status_request_token (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deal(id) on delete cascade,
  recipient_email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  user_account_id uuid references public.user_account(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  subject text not null,
  body text not null,
  related_entity_type text,
  related_entity_id uuid,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lead (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  source text not null,
  full_name text not null,
  email text,
  mobile text,
  message text,
  calculator_payload_json jsonb,
  assigned_to uuid references public.user_account(id) on delete set null,
  status public.lead_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  actor_id uuid references public.user_account(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action public.audit_action not null,
  before_json jsonb,
  after_json jsonb,
  ip_address inet,
  occurred_at timestamptz not null default now()
);

create table if not exists public.config_transfer_duty (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  brackets_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.config_transfer_duty enable row level security;

create policy "Transfer duty brackets viewable by authenticated users" on public.config_transfer_duty
  for select using (auth.role() = 'authenticated');

-- ─── 008 RLS POLICIES ──────────────────────────────────────────────────────
create or replace function public.get_current_agency_id()
returns uuid language sql stable security definer as $$
  select agency_id from public.user_account
  where auth_user_id = auth.uid()
  and status = 'active'
  limit 1;
$$;

alter table public.agency enable row level security;
alter table public.branch enable row level security;
alter table public.user_account enable row level security;
alter table public.ffc_certificate enable row level security;
alter table public.property enable row level security;
alter table public.party enable row level security;
alter table public.mandate enable row level security;
alter table public.conveyancer_firm enable row level security;
alter table public.deal enable row level security;
alter table public.deal_participant enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.deal_party enable row level security;
alter table public.suspensive_condition enable row level security;
alter table public.bond_application enable row level security;
alter table public.offer enable row level security;
alter table public.checklist_item enable row level security;
alter table public.commission_rule_set enable row level security;
alter table public.commission_rule_line enable row level security;
alter table public.commission_calculation enable row level security;
alter table public.commission_allocation enable row level security;
alter table public.commission_advance enable row level security;
alter table public.commission_clawback enable row level security;
alter table public.document enable row level security;
alter table public.signature_record enable row level security;
alter table public.status_request_token enable row level security;
alter table public.notification enable row level security;
alter table public.lead enable row level security;
alter table public.audit_log enable row level security;

do $$ begin create policy "Users can view their own agency" on public.agency for select using (id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view branches in their agency" on public.branch for select using (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view user accounts in their agency" on public.user_account for select using (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view and manage properties in their agency" on public.property for all using (agency_id = public.get_current_agency_id()) with check (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view and manage parties in their agency" on public.party for all using (agency_id = public.get_current_agency_id()) with check (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view and manage mandates in their agency" on public.mandate for all using (agency_id = public.get_current_agency_id()) with check (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view and manage deals in their agency" on public.deal for all using (agency_id = public.get_current_agency_id()) with check (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can manage suspensive conditions for agency deals" on public.suspensive_condition for all using (exists (select 1 from public.deal d where d.id = suspensive_condition.deal_id and d.agency_id = public.get_current_agency_id())); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view commission rule sets in their agency" on public.commission_rule_set for select using (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view and upload documents in their agency" on public.document for all using (agency_id = public.get_current_agency_id()) with check (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
do $$ begin create policy "Users can view their own notifications" on public.notification for select using (user_account_id in (select id from public.user_account where auth_user_id = auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "Anyone can insert a lead from public calculators" on public.lead for insert with check (agency_id is not null and lead_name is not null); exception when duplicate_object then null; end $$;
do $$ begin create policy "Agency users can view agency leads" on public.lead for select using (agency_id = public.get_current_agency_id()); exception when duplicate_object then null; end $$;
