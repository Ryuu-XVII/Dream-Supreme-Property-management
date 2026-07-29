-- =============================================================================
-- 007_tables_supporting.sql
-- Supporting entities: status requests, notifications, leads, audit logs,
-- and configuration data (§11.3)
-- =============================================================================

-- ─── Status Request Token ──────────────────────────────────────────────────
-- Used for the unauthenticated conveyancer update magic link (§5.3 FR-M1-09)
create table public.status_request_token (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references public.deal(id) on delete cascade,
  recipient_email text not null,
  token_hash      text not null,  -- hashed version of the token sent in email
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_status_token_deal on public.status_request_token(deal_id);

-- ─── Notification ──────────────────────────────────────────────────────────
create table public.notification (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references public.agency(id) on delete cascade,
  user_account_id     uuid references public.user_account(id) on delete cascade,
  channel             public.notification_channel not null default 'in_app',
  subject             text not null,
  body                text not null,
  related_entity_type text,  -- e.g. 'deal', 'suspensive_condition', 'ffc'
  related_entity_id   uuid,
  scheduled_for       timestamptz,
  sent_at             timestamptz,
  read_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index idx_notification_user on public.notification(user_account_id);
create index idx_notification_agency on public.notification(agency_id);

-- ─── Lead ──────────────────────────────────────────────────────────────────
-- Captured from public calculators (§10)
create table public.lead (
  id                      uuid primary key default gen_random_uuid(),
  agency_id               uuid not null references public.agency(id) on delete cascade,
  source                  text not null,  -- e.g. 'calculator_bond', 'calculator_yield'
  full_name               text not null,
  email                   text,
  mobile                  text,
  message                 text,
  calculator_payload_json jsonb,  -- the inputs/outputs of the calculator
  assigned_to             uuid references public.user_account(id) on delete set null,
  status                  public.lead_status not null default 'new',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_lead_agency on public.lead(agency_id);

-- ─── Audit Log ─────────────────────────────────────────────────────────────
-- Immutable audit log (§8 FR-M4-05)
create table public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agency(id) on delete cascade,
  actor_id        uuid references public.user_account(id) on delete set null,
  entity_type     text not null,  -- e.g. 'deal', 'party', 'commission_rule_set'
  entity_id       uuid not null,
  action          public.audit_action not null,
  before_json     jsonb,
  after_json      jsonb,
  ip_address      inet,
  occurred_at     timestamptz not null default now()
);
create index idx_audit_agency on public.audit_log(agency_id);
create index idx_audit_entity on public.audit_log(entity_type, entity_id);

-- ─── Configuration: Transfer Duty ──────────────────────────────────────────
-- Versioned configuration for transfer duty brackets (§10)
create table public.config_transfer_duty (
  id              uuid primary key default gen_random_uuid(),
  effective_from  date not null,
  brackets_json   jsonb not null,  -- array of brackets { min, max, base_amount, rate }
  created_at      timestamptz not null default now()
);
create index idx_transfer_duty_date on public.config_transfer_duty(effective_from desc);
