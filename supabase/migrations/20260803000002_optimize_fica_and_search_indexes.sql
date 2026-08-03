-- Phase 3 Indexing Optimization: Compliance (FICA/FFC), Documents & Party Filtering

-- 1. Party FICA Status Index (agency + fica_status + party_type)
create index if not exists idx_party_agency_fica_status 
  on public.party (agency_id, fica_status, party_type);

-- 2. FFC Certificate User & Expiry Index (user_account_id + expires_on)
create index if not exists idx_ffc_certificate_user_expires 
  on public.ffc_certificate (user_account_id, expires_on desc);

-- 3. Party Full Name Search Index (agency + full_name)
create index if not exists idx_party_agency_name 
  on public.party (agency_id, full_name);

-- 4. Document Storage Entity Association Index (agency + entity_type + entity_id)
create index if not exists idx_document_storage_agency_entity 
  on public.document_storage (agency_id, entity_type, entity_id);

-- 5. Commission Split Distribution Index (deal + agent)
create index if not exists idx_commission_split_deal_agent 
  on public.commission_split (deal_id, agent_id);
