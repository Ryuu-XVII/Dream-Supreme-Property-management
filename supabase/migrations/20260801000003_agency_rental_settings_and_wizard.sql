-- =============================================================================
-- AGENCY RENTAL SETTINGS & LEASE ONBOARDING RPC
-- Migration: 20260801000003_agency_rental_settings_and_wizard.sql
-- =============================================================================

-- 1. Add Rental Settings Columns to Agency Table
alter table public.agency
  add column if not exists default_management_fee_bps int not null default 800,
  add column if not exists default_procurement_fee_cents bigint not null default 0,
  add column if not exists pro_rata_calculation_basis text not null default 'exact_calendar_days' check (pro_rata_calculation_basis in ('exact_calendar_days', 'standard_30_days'));

-- 2. RPC to Execute Full Lease Onboarding Workflow
create or replace function public.create_lease_onboarding(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_lease_id uuid;
  v_property_id uuid := (p_payload->>'propertyId')::uuid;
  v_landlord_id uuid := (p_payload->>'landlordPartyId')::uuid;
  v_tenant_id uuid := (p_payload->>'tenantPartyId')::uuid;
  v_managed_by uuid := coalesce(nullif(p_payload->>'managedBy', '')::uuid, v_actor_id);
  v_monthly_rent_cents bigint := (p_payload->>'monthlyRentCents')::bigint;
  v_deposit_cents bigint := coalesce((p_payload->>'depositCents')::bigint, 0);
  v_deposit_held_by public.deposit_holder := coalesce((p_payload->>'depositHeldBy')::public.deposit_holder, 'agency_trust');
  v_procurement_fee_cents bigint := coalesce((p_payload->>'procurementFeeCents')::bigint, 0);
  v_management_fee_bps int := coalesce((p_payload->>'managementFeeBps')::int, 800);
  v_start_on date := (p_payload->>'startOn')::date;
  v_end_on date := (p_payload->>'endOn')::date;
  v_escalation_rate_bps int := coalesce((p_payload->>'escalationRateBps')::int, 800);
  v_escalation_month smallint := coalesce((p_payload->>'escalationMonth')::smallint, 1);
  v_admin_fee_cents bigint := coalesce((p_payload->>'adminFeeCents')::bigint, 150000);
  v_pro_rata_rent_cents bigint := coalesce((p_payload->>'proRataRentCents')::bigint, 0);
  v_inspection_date date := nullif(p_payload->>'inspectionDate', '')::date;
  v_inv_id uuid;
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active authenticated user session is required.';
  end if;

  if v_property_id is null or v_landlord_id is null or v_tenant_id is null then
    raise exception 'Property, Landlord, and Tenant selections are required.';
  end if;

  if v_monthly_rent_cents <= 0 or v_start_on is null or v_end_on is null then
    raise exception 'Monthly rent, start date, and end date are required.';
  end if;

  -- Insert Lease Record
  insert into public.lease (
    agency_id, property_id, landlord_party_id, tenant_party_id, managed_by,
    start_on, end_on, monthly_rent_cents, escalation_rate_bps, escalation_month,
    deposit_cents, deposit_held_by, procurement_fee_cents, management_fee_bps, status
  ) values (
    v_agency_id, v_property_id, v_landlord_id, v_tenant_id, v_managed_by,
    v_start_on, v_end_on, v_monthly_rent_cents, v_escalation_rate_bps, v_escalation_month,
    v_deposit_cents, v_deposit_held_by, v_procurement_fee_cents, v_management_fee_bps, 'active'
  ) returning id into v_lease_id;

  -- Insert Deposit Sub-Ledger Entry if deposit held in trust
  if v_deposit_cents > 0 and v_deposit_held_by = 'agency_trust' then
    insert into public.trust_account_ledger (
      agency_id, lease_id, account_type, transaction_type, amount_cents,
      reference_number, bank_statement_date, payer_payee_name, approved_by_principal, approved_at
    ) values (
      v_agency_id, v_lease_id, 'section_86_4_investment', 'deposit_inflow', v_deposit_cents,
      'DEP-LEASE-' || v_lease_id::text, current_date, 'Tenant Deposit', v_actor_id, now()
    );
  end if;

  -- Insert Initial Invoice (Deposit + Admin Fee + Pro-Rata Rent)
  insert into public.lease_invoice (
    lease_id, period_start, period_end, rent_cents, other_charges_cents, total_cents, due_on, status
  ) values (
    v_lease_id, v_start_on, v_end_on, v_pro_rata_rent_cents, (v_deposit_cents + v_admin_fee_cents),
    (v_pro_rata_rent_cents + v_deposit_cents + v_admin_fee_cents), v_start_on, 'issued'
  ) returning id into v_inv_id;

  -- Schedule Mandatory Ingoing Inspection if date provided
  if v_inspection_date is not null then
    insert into public.inspection (
      lease_id, inspection_type, conducted_on, conducted_by
    ) values (
      v_lease_id, 'in-going', v_inspection_date, v_managed_by
    );
  end if;

  -- Automated Audit Log
  insert into public.audit_log (
    agency_id, actor_id, entity_type, entity_id, action, after_json
  ) values (
    v_agency_id, v_actor_id, 'lease', v_lease_id, 'create',
    jsonb_build_object(
      'summary', 'Full Lease Onboarding Completed',
      'monthly_rent_cents', v_monthly_rent_cents,
      'deposit_cents', v_deposit_cents,
      'deposit_held_by', v_deposit_held_by,
      'management_fee_bps', v_management_fee_bps,
      'initial_invoice_id', v_inv_id
    )
  );

  return v_lease_id;
end;
$$;

revoke all on function public.create_lease_onboarding(jsonb) from public, anon;
grant execute on function public.create_lease_onboarding(jsonb) to authenticated;
