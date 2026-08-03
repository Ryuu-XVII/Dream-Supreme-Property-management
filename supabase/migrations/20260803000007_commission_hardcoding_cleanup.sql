-- Migration: 20260803000007_commission_hardcoding_cleanup.sql
-- Description: Updates the calculate_tiered_commission_splits function to remove hardcoded 15% VAT and 5% default commission

create or replace function public.calculate_tiered_commission_splits(
  p_deal_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_purchase_price bigint;
  v_vat_rate numeric;
  v_gross_commission bigint;
  v_vat_cents bigint;
  v_net_commission bigint;
  v_agent_split_pct numeric := 50.00;
  v_franchise_fee_pct numeric := 0.00;
  v_desk_fee_cents bigint := 0;
  v_agent_payout bigint;
  v_agency_retention bigint;
  v_default_commission_rate numeric := 0.05;
begin
  select d.purchase_price_cents
  into v_purchase_price
  from public.deal d
  where d.id = p_deal_id and d.agency_id = v_agency_id;

  if v_purchase_price is null then
    raise exception 'Deal not found or invalid agency session.';
  end if;

  -- Fetch VAT rate dynamically
  v_vat_rate := public.get_vat_rate();

  -- Fetch agency default commission rate
  select (default_commission_rate_bps::numeric / 10000.0)
  into v_default_commission_rate
  from public.commission_rule_set
  where agency_id = v_agency_id and is_default = true
  limit 1;

  if v_default_commission_rate is null then
    v_default_commission_rate := 0.05;
  end if;

  -- Default gross commission rule
  v_gross_commission := (v_purchase_price * v_default_commission_rate)::bigint;
  v_vat_cents := (v_gross_commission * v_vat_rate)::bigint;
  v_net_commission := v_gross_commission - v_vat_cents;

  -- Fetch matching sliding scale tier
  select r.agent_split_pct, r.franchise_fee_pct, r.desk_fee_cents
  into v_agent_split_pct, v_franchise_fee_pct, v_desk_fee_cents
  from public.commission_tier_rule r
  where r.agency_id = v_agency_id
    and v_purchase_price >= r.min_volume_cents
    and (r.max_volume_cents is null or v_purchase_price <= r.max_volume_cents)
  limit 1;

  v_agent_payout := ((v_net_commission * v_agent_split_pct / 100.0) - v_desk_fee_cents)::bigint;
  if v_agent_payout < 0 then
    v_agent_payout := 0;
  end if;
  v_agency_retention := v_net_commission - v_agent_payout;

  return jsonb_build_object(
    'deal_id', p_deal_id,
    'gross_commission_cents', v_gross_commission,
    'vat_cents', v_vat_cents,
    'net_commission_cents', v_net_commission,
    'agent_split_pct', v_agent_split_pct,
    'agent_payout_cents', v_agent_payout,
    'agency_retention_cents', v_agency_retention
  );
end;
$$;
