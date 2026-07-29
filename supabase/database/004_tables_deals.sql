-- =============================================================================
-- 004_tables_deals.sql
-- Deal pipeline entities: deal, participants, stage history, conditions,
-- bond applications, offers, checklist items
-- =============================================================================

-- ─── Deal ───────────────────────────────────────────────────────────────────
create table public.deal (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agency(id) on delete restrict,
  branch_id             uuid references public.branch(id) on delete set null,
  property_id           uuid not null references public.property(id) on delete restrict,
  mandate_id            uuid references public.mandate(id) on delete set null,
  deal_type             public.deal_type not null default 'sale',
  reference             text not null,  -- human-readable deal ref, e.g. DSP-2026-0042
  stage                 public.deal_stage not null default 'mandate_signed',
  status                public.deal_status not null default 'active',
  sale_price_cents      bigint not null default 0,
  otp_signed_on         date,
  occupation_date       date,
  transfer_date         date,
  registration_date     date,
  conveyancer_firm_id   uuid references public.conveyancer_firm(id) on delete set null,
  conveyancer_reference text,
  is_vat_sale           boolean not null default false,
  cancellation_reason   public.cancellation_reason,
  cancellation_notes    text,
  cancelled_on          date,
  created_by            uuid references public.user_account(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  archived_at           timestamptz
);
create index idx_deal_agency on public.deal(agency_id);
create index idx_deal_stage on public.deal(agency_id, stage);
create index idx_deal_status on public.deal(agency_id, status);
create index idx_deal_property on public.deal(property_id);
create unique index idx_deal_reference on public.deal(agency_id, reference);

-- ─── Deal Participant ──────────────────────────────────────────────────────
-- Supports multiple practitioners per deal and external agencies (§5.2 FR-M1-05)
create table public.deal_participant (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references public.deal(id) on delete cascade,
  user_account_id     uuid references public.user_account(id) on delete set null,
  external_agency_name text,
  role                public.participant_role not null default 'listing_agent',
  split_type          public.split_type not null default 'percentage',
  split_value         int not null default 0,  -- bps if percentage, cents if fixed
  is_external         boolean not null default false,
  created_at          timestamptz not null default now()
);
create index idx_participant_deal on public.deal_participant(deal_id);
create index idx_participant_user on public.deal_participant(user_account_id);

-- ─── Deal Stage History ────────────────────────────────────────────────────
-- Every stage transition is recorded for audit (§5.2 FR-M1-03)
create table public.deal_stage_history (
  id                        uuid primary key default gen_random_uuid(),
  deal_id                   uuid not null references public.deal(id) on delete cascade,
  from_stage                public.deal_stage,
  to_stage                  public.deal_stage not null,
  changed_by                uuid references public.user_account(id) on delete set null,
  changed_by_external_email text,  -- for conveyancer updates
  reason                    text,
  is_override               boolean not null default false,  -- gate condition override (FR-M1-02)
  occurred_at               timestamptz not null default now()
);
create index idx_stage_history_deal on public.deal_stage_history(deal_id);

-- ─── Deal Party (junction: links parties to deals) ─────────────────────────
create table public.deal_party (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deal(id) on delete cascade,
  party_id    uuid not null references public.party(id) on delete restrict,
  role        public.party_type not null,  -- seller / purchaser on this deal
  created_at  timestamptz not null default now(),
  unique(deal_id, party_id, role)
);
create index idx_deal_party_deal on public.deal_party(deal_id);

-- ─── Suspensive Condition ──────────────────────────────────────────────────
create table public.suspensive_condition (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references public.deal(id) on delete cascade,
  condition_type    public.condition_type not null,
  description       text,
  due_on            date not null,
  original_due_on   date not null,
  responsible_party text,  -- free text — the person or entity responsible
  status            public.condition_status not null default 'pending',
  fulfilled_on      date,
  extension_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_condition_deal on public.suspensive_condition(deal_id);
create index idx_condition_due on public.suspensive_condition(status, due_on)
  where status = 'pending';

-- ─── Bond Application ──────────────────────────────────────────────────────
create table public.bond_application (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid not null references public.deal(id) on delete cascade,
  institution           text not null,
  originator            text,
  applied_on            date,
  status                public.bond_app_status not null default 'not_applied',
  approved_amount_cents bigint,
  status_updated_on     date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_bond_app_deal on public.bond_application(deal_id);

-- ─── Offer ──────────────────────────────────────────────────────────────────
create table public.offer (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references public.deal(id) on delete cascade,
  property_id         uuid not null references public.property(id) on delete restrict,
  purchaser_party_id  uuid references public.party(id) on delete set null,
  offer_price_cents   bigint not null default 0,
  deposit_cents       bigint not null default 0,
  bond_amount_cents   bigint not null default 0,
  expires_on          date,
  status              public.offer_status not null default 'pending',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_offer_deal on public.offer(deal_id);

-- ─── Checklist Item ────────────────────────────────────────────────────────
-- Per-deal document checklist (§5.2 FR-M1-08, Appendix A)
create table public.checklist_item (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deal(id) on delete cascade,
  category      text not null,
  label         text not null,
  is_required   boolean not null default true,
  is_complete   boolean not null default false,
  document_id   uuid,  -- FK added after document table
  completed_on  date,
  completed_by  uuid references public.user_account(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index idx_checklist_deal on public.checklist_item(deal_id);
