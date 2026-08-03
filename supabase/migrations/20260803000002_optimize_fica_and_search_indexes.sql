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

-- 4. Document Storage Deal & Category Index (agency + deal_id + category)
create index if not exists idx_document_agency_deal 
  on public.document (agency_id, deal_id, category);

-- 5. Commission Allocation Payee Index (calculation_id + user_account_id)
create index if not exists idx_commission_allocation_calc_user 
  on public.commission_allocation (calculation_id, user_account_id);
