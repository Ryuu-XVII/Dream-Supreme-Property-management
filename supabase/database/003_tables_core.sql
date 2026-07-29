-- =============================================================================
-- 003_tables_core.sql
-- Core entities: agency, branch, user_account, ffc, property, party, mandate
-- All amounts stored as bigint cents (FR-M3-09). All IDs are UUID.
-- Every tenant-scoped table carries agency_id for RLS (§12.2).
-- No hard deletes — soft delete with archived_at (§3.1).
-- =============================================================================

-- ─── Agency ─────────────────────────────────────────────────────────────────
create table public.agency (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  registration_number text,
  ppra_reference text,
  vat_number    text,
  is_vat_vendor boolean not null default false,
  address       text,
  logo_key      text,          -- storage key in Supabase Storage
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);

-- ─── Branch ─────────────────────────────────────────────────────────────────
create table public.branch (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agency(id) on delete restrict,
  name          text not null,
  address       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);
create index idx_branch_agency on public.branch(agency_id);

-- ─── User Account ──────────────────────────────────────────────────────────
-- Maps to Supabase Auth via auth.users.id
create table public.user_account (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  agency_id     uuid not null references public.agency(id) on delete restrict,
  branch_id     uuid references public.branch(id) on delete set null,
  full_name     text not null,
  email         text not null,
  mobile        text,
  role          public.user_role not null default 'agent',
  status        public.user_status not null default 'active',
  ppra_reference text,
  is_candidate  boolean not null default false,
  supervisor_id uuid references public.user_account(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);
create index idx_user_agency on public.user_account(agency_id);
create index idx_user_auth on public.user_account(auth_user_id);
create unique index idx_user_email_agency on public.user_account(agency_id, email);

-- ─── FFC Certificate ───────────────────────────────────────────────────────
create table public.ffc_certificate (
  id                uuid primary key default gen_random_uuid(),
  user_account_id   uuid not null references public.user_account(id) on delete restrict,
  certificate_number text not null,
  issued_on         date not null,
  expires_on        date not null,
  document_id       uuid,  -- FK added after document table is created
  created_at        timestamptz not null default now()
);
create index idx_ffc_user on public.ffc_certificate(user_account_id);

-- ─── Property ───────────────────────────────────────────────────────────────
create table public.property (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agency(id) on delete restrict,
  address_line      text not null,
  suburb            text,
  city              text,
  province          text,
  postal_code       text,
  erf_number        text,
  title_deed_number text,
  property_type     public.property_type not null default 'house',
  is_sectional_title boolean not null default false,
  bedrooms          smallint,
  bathrooms         smallint,
  garages           smallint,
  erf_size_sqm      numeric(12,2),
  floor_size_sqm    numeric(12,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz
);
create index idx_property_agency on public.property(agency_id);

-- ─── Party (buyer, seller, landlord, tenant, referrer) ─────────────────────
create table public.party (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agency(id) on delete restrict,
  party_type        public.party_type not null,
  entity_type       public.entity_type not null default 'natural_person',
  full_name         text not null,
  id_or_reg_number  text,
  email             text,
  mobile            text,
  marital_status    text,
  is_vat_vendor     boolean not null default false,
  fica_status       public.fica_status not null default 'not_started',
  fica_completed_on date,
  popia_consent_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz
);
create index idx_party_agency on public.party(agency_id);

-- ─── Mandate ────────────────────────────────────────────────────────────────
create table public.mandate (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agency(id) on delete restrict,
  property_id           uuid not null references public.property(id) on delete restrict,
  mandate_type          public.mandate_type not null default 'sole',
  listing_price_cents   bigint not null default 0,
  commission_rate_bps   int not null default 0,  -- basis points (500 = 5%)
  signed_on             date,
  expires_on            date,
  document_id           uuid,  -- FK added after document table
  status                public.mandate_status not null default 'active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_mandate_agency on public.mandate(agency_id);
create index idx_mandate_property on public.mandate(property_id);

-- ─── Conveyancer Firm ──────────────────────────────────────────────────────
create table public.conveyancer_firm (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agency(id) on delete restrict,
  name          text not null,
  contact_name  text,
  email         text,
  telephone     text,
  is_preferred  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);
create index idx_conveyancer_agency on public.conveyancer_firm(agency_id);
