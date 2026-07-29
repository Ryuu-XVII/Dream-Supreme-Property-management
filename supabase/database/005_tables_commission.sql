-- =============================================================================
-- 005_tables_commission.sql
-- Commission engine entities (§7, §11.2)
-- All money as bigint cents. No floating-point anywhere (FR-M3-09).
-- =============================================================================

-- ─── Commission Rule Set ───────────────────────────────────────────────────
create table public.commission_rule_set (
  id                        uuid primary key default gen_random_uuid(),
  agency_id                 uuid not null references public.agency(id) on delete restrict,
  name                      text not null,
  effective_from            date not null,
  effective_to              date,
  is_default                boolean not null default false,
  vat_treatment             public.vat_treatment not null default 'inclusive',
  default_commission_rate_bps int not null default 500,  -- 5% = 500 bps
  franchise_fee_bps         int not null default 0,
  office_share_bps          int not null default 5000,  -- 50% = 5000 bps
  rounding_mode             public.rounding_mode not null default 'half_up',
  created_by                uuid references public.user_account(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index idx_ruleset_agency on public.commission_rule_set(agency_id);

-- ─── Commission Rule Line ──────────────────────────────────────────────────
-- Ordered deductions applied in sequence (§7.1 STEP 3)
create table public.commission_rule_line (
  id                  uuid primary key default gen_random_uuid(),
  rule_set_id         uuid not null references public.commission_rule_set(id) on delete cascade,
  sequence            int not null,  -- execution order
  line_type           public.commission_line_type not null,
  calculation_basis   text,  -- 'net', 'gross', 'pool' etc.
  rate_bps            int not null default 0,
  fixed_amount_cents  bigint not null default 0,
  payee_type          text,  -- 'franchise', 'referrer', 'external_agency'
  description         text,
  created_at          timestamptz not null default now()
);
create index idx_rule_line_set on public.commission_rule_line(rule_set_id);

-- ─── Commission Calculation ────────────────────────────────────────────────
-- Full 7-step calculation snapshot (§7.1)
create table public.commission_calculation (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deal(id) on delete restrict,
  rule_set_id             uuid not null references public.commission_rule_set(id) on delete restrict,
  calculated_at           timestamptz not null default now(),
  calculated_by           uuid references public.user_account(id) on delete set null,
  gross_cents             bigint not null default 0,
  vat_cents               bigint not null default 0,
  net_cents               bigint not null default 0,
  distributable_pool_cents bigint not null default 0,
  office_share_cents      bigint not null default 0,
  agent_pool_cents        bigint not null default 0,
  input_snapshot_json     jsonb not null default '{}'::jsonb,  -- full reproducibility (FR-M3-11)
  status                  public.commission_calc_status not null default 'provisional',
  created_at              timestamptz not null default now()
);
create index idx_calc_deal on public.commission_calculation(deal_id);

-- ─── Commission Allocation ─────────────────────────────────────────────────
-- Per-practitioner breakdown from a calculation
create table public.commission_allocation (
  id                      uuid primary key default gen_random_uuid(),
  calculation_id          uuid not null references public.commission_calculation(id) on delete cascade,
  user_account_id         uuid references public.user_account(id) on delete set null,
  external_payee_name     text,
  allocation_type         text,  -- 'practitioner', 'franchise', 'referrer'
  gross_allocation_cents  bigint not null default 0,
  desk_fee_cents          bigint not null default 0,
  advance_recovery_cents  bigint not null default 0,
  net_payable_cents       bigint not null default 0,
  created_at              timestamptz not null default now()
);
create index idx_allocation_calc on public.commission_allocation(calculation_id);
create index idx_allocation_user on public.commission_allocation(user_account_id);

-- ─── Commission Advance ────────────────────────────────────────────────────
create table public.commission_advance (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agency(id) on delete restrict,
  user_account_id uuid not null references public.user_account(id) on delete restrict,
  deal_id         uuid references public.deal(id) on delete set null,
  amount_cents    bigint not null default 0,
  advanced_on     date not null,
  recovered_cents bigint not null default 0,
  status          public.advance_status not null default 'outstanding',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_advance_agency on public.commission_advance(agency_id);
create index idx_advance_user on public.commission_advance(user_account_id);

-- ─── Commission Clawback ───────────────────────────────────────────────────
create table public.commission_clawback (
  id              uuid primary key default gen_random_uuid(),
  calculation_id  uuid not null references public.commission_calculation(id) on delete restrict,
  user_account_id uuid not null references public.user_account(id) on delete restrict,
  amount_cents    bigint not null default 0,
  reason          text,
  raised_on       date not null,
  recovered_on    date,
  created_at      timestamptz not null default now()
);
create index idx_clawback_calc on public.commission_clawback(calculation_id);
