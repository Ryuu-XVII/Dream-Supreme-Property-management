-- Phase 3 Indexing Optimization: Compliance (FICA/FFC), Documents & Party Filtering

-- 1. FICA Verification Status Index (agency + verification_status)
create index if not exists idx_fica_verification_agency_status 
  on public.fica_verification (agency_id, verification_status);

-- 2. FFC Certificate Expiry & Status Index (agency + status + expiry_date)
create index if not exists idx_ffc_certificate_agency_status 
  on public.ffc_certificate (agency_id, status, expiry_date);

-- 3. Party Name Lookup & Type Index (agency + party_type)
create index if not exists idx_party_agency_type 
  on public.party (agency_id, party_type);

-- 4. Document Storage Entity Association Index (agency + entity_type + entity_id)
create index if not exists idx_document_storage_agency_entity 
  on public.document_storage (agency_id, entity_type, entity_id);

-- 5. Commission Split Distribution Index (deal + agent)
create index if not exists idx_commission_split_deal_agent 
  on public.commission_split (deal_id, agent_id);
