-- =============================================================================
-- SUPABASE DOCUMENT GENERATION ENGINE & SINGLE-PRINCIPAL TRUST AUDIT RPC
-- Migration: 20260801000002_supabase_document_generation.sql
-- =============================================================================

-- 1. RPC to Record Single-Principal Approved Trust Transactions with Automated Audit Logging
create or replace function public.record_trust_transaction(
  p_deal_id uuid default null,
  p_lease_id uuid default null,
  p_account_type public.trust_account_type default 'section_86_4_investment',
  p_transaction_type public.trust_transaction_type default 'deposit_inflow',
  p_amount_cents bigint default 0,
  p_reference_number text default '',
  p_bank_statement_date date default current_date,
  p_payer_payee_name text default '',
  p_interest_split_client_pct numeric default 95.00,
  p_interest_split_ppra_pct numeric default 5.00
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_role public.user_role := public.get_current_role();
  v_ledger_id uuid;
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active authenticated user session is required.';
  end if;

  if v_role not in ('principal', 'admin') then
    raise exception 'Only an agency principal or administrator can authorize trust account transactions.';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'Trust transaction amount must be greater than zero.';
  end if;

  if nullif(trim(p_reference_number), '') is null or nullif(trim(p_payer_payee_name), '') is null then
    raise exception 'Reference number and payer/payee details are required.';
  end if;

  -- Single-Principal Approval & Insertion
  insert into public.trust_account_ledger (
    agency_id, deal_id, lease_id, account_type, transaction_type,
    amount_cents, reference_number, bank_statement_date, payer_payee_name,
    interest_split_client_pct, interest_split_ppra_pct,
    approved_by_principal, approved_at
  ) values (
    v_agency_id, p_deal_id, p_lease_id, p_account_type, p_transaction_type,
    p_amount_cents, trim(p_reference_number), p_bank_statement_date, trim(p_payer_payee_name),
    p_interest_split_client_pct, p_interest_split_ppra_pct,
    v_actor_id, now()
  ) returning id into v_ledger_id;

  -- Automated Audit Logging
  insert into public.audit_log (
    agency_id, actor_id, entity_type, entity_id, action, after_json
  ) values (
    v_agency_id, v_actor_id, 'trust_account_ledger', v_ledger_id, 'create',
    jsonb_build_object(
      'summary', 'Single-Principal Trust Transaction Approved',
      'account_type', p_account_type,
      'transaction_type', p_transaction_type,
      'amount_cents', p_amount_cents,
      'reference_number', p_reference_number,
      'payer_payee', p_payer_payee_name,
      'approved_by_principal', v_actor_id,
      'approved_at', now()
    )
  );

  return v_ledger_id;
end;
$$;

revoke all on function public.record_trust_transaction from public, anon;
grant execute on function public.record_trust_transaction to authenticated;


-- 2. RPC for Supabase Server-Side Document Merge & Auto-Generation
create or replace function public.generate_document_from_template(
  p_template_id uuid,
  p_deal_id uuid default null,
  p_lease_id uuid default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_template public.document_template%rowtype;
  v_deal public.deal%rowtype;
  v_property public.property%rowtype;
  v_lease public.lease%rowtype;
  v_merged_content text;
  v_doc_id uuid;
  v_filename text;
  v_storage_key text;
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_template from public.document_template
  where id = p_template_id and agency_id = v_agency_id;

  if v_template.id is null then
    raise exception 'Document template not found.';
  end if;

  v_merged_content := v_template.body_markdown;

  if p_deal_id is not null then
    select * into v_deal from public.deal where id = p_deal_id and agency_id = v_agency_id;
    if v_deal.id is null then raise exception 'Deal not found.'; end if;
    select * into v_property from public.property where id = v_deal.property_id;

    v_merged_content := replace(v_merged_content, '{{deal_reference}}', coalesce(v_deal.reference, ''));
    v_merged_content := replace(v_merged_content, '{{sale_price}}', coalesce((v_deal.sale_price_cents / 100)::text, '0'));
    v_merged_content := replace(v_merged_content, '{{property_address}}', coalesce(v_property.address_line, ''));
    v_merged_content := replace(v_merged_content, '{{erf_number}}', coalesce(v_property.erf_number, 'N/A'));
    v_filename := lower(regexp_replace(v_template.name, '[^a-zA-Z0-9]', '_', 'g')) || '_' || v_deal.reference || '.md';
  elsif p_lease_id is not null then
    select * into v_lease from public.lease where id = p_lease_id and agency_id = v_agency_id;
    if v_lease.id is null then raise exception 'Lease not found.'; end if;
    select * into v_property from public.property where id = v_lease.property_id;

    v_merged_content := replace(v_merged_content, '{{monthly_rent}}', coalesce((v_lease.monthly_rent_cents / 100)::text, '0'));
    v_merged_content := replace(v_merged_content, '{{start_date}}', coalesce(v_lease.start_on::text, ''));
    v_merged_content := replace(v_merged_content, '{{end_date}}', coalesce(v_lease.end_on::text, ''));
    v_merged_content := replace(v_merged_content, '{{property_address}}', coalesce(v_property.address_line, ''));
    v_filename := lower(regexp_replace(v_template.name, '[^a-zA-Z0-9]', '_', 'g')) || '_lease_' || p_lease_id::text || '.md';
  else
    v_filename := lower(regexp_replace(v_template.name, '[^a-zA-Z0-9]', '_', 'g')) || '_generated.md';
  end if;

  v_storage_key := v_agency_id::text || '/generated/' || v_filename;

  insert into public.document (
    agency_id, deal_id, category, filename, storage_key, mime_type, uploaded_by
  ) values (
    v_agency_id, p_deal_id, v_template.category, v_filename, v_storage_key, 'text/markdown', v_actor_id
  ) returning id into v_doc_id;

  insert into public.audit_log (
    agency_id, actor_id, entity_type, entity_id, action, after_json
  ) values (
    v_agency_id, v_actor_id, 'document', v_doc_id, 'create',
    jsonb_build_object(
      'summary', 'Supabase Auto-Generated Document from Template',
      'template_name', v_template.name,
      'filename', v_filename,
      'deal_id', p_deal_id,
      'lease_id', p_lease_id
    )
  );

  return v_doc_id;
end;
$$;

revoke all on function public.generate_document_from_template from public, anon;
grant execute on function public.generate_document_from_template to authenticated;
