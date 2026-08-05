-- Phase 1 Indexing Optimization: Core Tenant & Entity Query Optimization

-- 1. User Account Lookup Index (agency + auth_user_id)
create index if not exists idx_user_account_agency_auth 
  on public.user_account (agency_id, auth_user_id);

-- 2. Property Type & Agency Filtering Index
create index if not exists idx_property_agency_type 
  on public.property (agency_id, property_type, created_at desc);

-- 3. Mandate Lookup Index (agency + property + status)
create index if not exists idx_mandate_agency_property 
  on public.mandate (agency_id, property_id, status);

-- 4. Deal Pipeline Stage Index (agency + stage + created_at)
create index if not exists idx_deal_agency_stage 
  on public.deal (agency_id, stage, created_at desc);

-- 5. Deal Participant Lookup Index
create index if not exists idx_deal_participant_deal_user 
  on public.deal_participant (deal_id, user_account_id);
