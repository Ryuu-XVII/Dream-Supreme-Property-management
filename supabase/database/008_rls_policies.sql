-- =============================================================================
-- 008_rls_policies.sql
-- Row Level Security (RLS) policies for multi-tenancy (§12.2)
-- Enforces that users can only access data belonging to their agency.
-- =============================================================================

-- Helper function to get the agency_id of the currently authenticated user
create or replace function public.get_current_agency_id()
returns uuid
language sql
stable
security definer
as $$
  select agency_id from public.user_account
  where auth_user_id = auth.uid()
  and status = 'active'
  limit 1;
$$;

-- ─── Enable RLS on all tenant-scoped tables ────────────────────────────────

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

-- ─── RLS Policies ──────────────────────────────────────────────────────────

-- Agency
create policy "Users can view their own agency"
  on public.agency for select
  using (id = public.get_current_agency_id());

-- Branch
create policy "Users can view branches in their agency"
  on public.branch for select
  using (agency_id = public.get_current_agency_id());

-- User Account
create policy "Users can view user accounts in their agency"
  on public.user_account for select
  using (agency_id = public.get_current_agency_id());

-- Property
create policy "Users can view and manage properties in their agency"
  on public.property for all
  using (agency_id = public.get_current_agency_id())
  with check (agency_id = public.get_current_agency_id());

-- Party
create policy "Users can view and manage parties in their agency"
  on public.party for all
  using (agency_id = public.get_current_agency_id())
  with check (agency_id = public.get_current_agency_id());

-- Mandate
create policy "Users can view and manage mandates in their agency"
  on public.mandate for all
  using (agency_id = public.get_current_agency_id())
  with check (agency_id = public.get_current_agency_id());

-- Deal
create policy "Users can view and manage deals in their agency"
  on public.deal for all
  using (agency_id = public.get_current_agency_id())
  with check (agency_id = public.get_current_agency_id());

-- Suspensive Condition
create policy "Users can manage suspensive conditions for agency deals"
  on public.suspensive_condition for all
  using (exists (
    select 1 from public.deal d
    where d.id = suspensive_condition.deal_id
    and d.agency_id = public.get_current_agency_id()
  ));

-- Commission Rule Set
create policy "Users can view commission rule sets in their agency"
  on public.commission_rule_set for select
  using (agency_id = public.get_current_agency_id());

create policy "Principals can manage commission rule sets"
  on public.commission_rule_set for all
  using (
    agency_id = public.get_current_agency_id()
    and exists (
      select 1 from public.user_account u
      where u.auth_user_id = auth.uid()
      and u.role in ('principal', 'admin')
    )
  );

-- Document
create policy "Users can view and upload documents in their agency"
  on public.document for all
  using (agency_id = public.get_current_agency_id())
  with check (agency_id = public.get_current_agency_id());

-- Notification
create policy "Users can view their own notifications"
  on public.notification for select
  using (user_account_id in (
    select id from public.user_account where auth_user_id = auth.uid()
  ));

-- Public Leads (insertable without auth for public calculators)
alter table public.lead enable row level security;

create policy "Anyone can insert a lead from public calculators"
  on public.lead for insert
  with check (true);

create policy "Agency users can view agency leads"
  on public.lead for select
  using (agency_id = public.get_current_agency_id());
