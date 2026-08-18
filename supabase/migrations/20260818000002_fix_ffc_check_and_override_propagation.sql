-- Fix: Allow FFC verification to recognize uploaded FFC documents and FFC certificate records,
-- and propagate p_override from transition_deal to calculate_deal_commission.

create or replace function public.calculate_deal_commission(
  p_deal_id uuid,
  p_rule_set_id uuid default null,
  p_override boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_mandate public.mandate%rowtype;
  v_rule public.commission_rule_set%rowtype;
  v_calc_id uuid;
  v_gross bigint;
  v_vat bigint;
  v_net bigint;
  v_franchise_fee bigint := 0;
  v_pool bigint;
  v_office bigint;
  v_agent_pool bigint;
  v_line public.commission_rule_line%rowtype;
  v_participant public.deal_participant%rowtype;
  v_allocation bigint;
  v_advance bigint;
  v_allocated bigint := 0;
  v_invalid_ffc text;
  v_branch_fee_pct numeric(5,2) := 0;
begin
  if public.get_current_role() not in ('admin', 'admin_agent') then raise exception 'Only an administrator can calculate commission.'; end if;
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;

  select * into v_deal from public.deal where id = p_deal_id;
  select * into v_mandate from public.mandate where id = v_deal.mandate_id;

  if p_rule_set_id is not null then
    select * into v_rule from public.commission_rule_set where id = p_rule_set_id and agency_id = v_deal.agency_id;
  else
    -- Tier 1: Default rule set covering registration date
    select * into v_rule from public.commission_rule_set
    where agency_id = v_deal.agency_id and is_default
      and effective_from <= coalesce(v_deal.registration_date, current_date)
      and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
    order by effective_from desc limit 1;

    -- Tier 2: Any rule set covering registration date
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
        and effective_from <= coalesce(v_deal.registration_date, current_date)
        and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
      order by is_default desc, effective_from desc limit 1;
    end if;

    -- Tier 3: Any default rule set for the agency
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id and is_default
      order by effective_from desc limit 1;
    end if;

    -- Tier 4: Most recent rule set for the agency
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
      order by is_default desc, effective_from desc limit 1;
    end if;
  end if;

  if v_rule.id is null then
    raise exception 'No applicable commission rule set exists. Please create a rule set under Admin > Commission Rules.';
  end if;

  -- FFC Validation (bypassed if admin override is explicitly set)
  if not coalesce(p_override, false) then
    select string_agg(u.full_name, ', ') into v_invalid_ffc
    from public.deal_participant dp
    join public.user_account u on u.id = dp.user_account_id
    where dp.deal_id = p_deal_id and not dp.is_external
      and not (
        exists (
          select 1 from public.ffc_certificate f
          where f.user_account_id = u.id
            and (f.issued_on is null or f.issued_on <= coalesce(v_deal.registration_date, current_date))
            and (f.expires_on is null or f.expires_on >= coalesce(v_deal.registration_date, current_date))
        )
        or exists (
          select 1 from public.document d
          where (d.user_account_id = u.id or d.uploaded_by = u.id)
            and d.category in ('ffc_certificate', 'ffc')
        )
        or exists (
          select 1 from public.ffc_certificate f
          where f.user_account_id = u.id
        )
      );
    if v_invalid_ffc is not null then raise exception 'Valid FFC required for: %', v_invalid_ffc; end if;
  end if;

  if (select coalesce(sum(split_value), 0) from public.deal_participant where deal_id = p_deal_id and split_type = 'percentage') <> 100 then
    raise exception 'Practitioner percentage splits must total 100.';
  end if;

  v_gross := round(v_deal.sale_price_cents::numeric * coalesce(nullif(v_mandate.commission_rate_bps, 0), v_rule.default_commission_rate_bps) / 10000)::bigint;

  if v_rule.vat_treatment = 'inclusive' then
    v_net := round(v_gross::numeric / (1 + public.get_vat_rate()))::bigint;
    v_vat := v_gross - v_net;
  elsif v_rule.vat_treatment = 'exclusive' then
    v_net := v_gross;
    v_vat := round(v_gross::numeric * public.get_vat_rate())::bigint;
  else
    v_net := v_gross;
    v_vat := 0;
  end if;

  -- Calculate Franchise Fee
  if v_deal.branch_id is not null then
    select coalesce(franchise_fee_pct, 0) into v_branch_fee_pct from public.branch where id = v_deal.branch_id;
    if v_branch_fee_pct > 0 then
      v_franchise_fee := round(v_net::numeric * (v_branch_fee_pct / 100))::bigint;
    end if;
  end if;

  -- Distributable pool is Net minus Franchise Fee
  v_pool := v_net - v_franchise_fee;

  for v_line in select * from public.commission_rule_line where rule_set_id = v_rule.id and line_type <> 'office_share' order by sequence loop
    if v_line.calculation_basis = 'fixed' then
      v_pool := v_pool - v_line.fixed_amount_cents;
    elsif v_line.calculation_basis = 'percentage_of_remaining' then
      v_pool := v_pool - round(v_pool::numeric * v_line.rate_bps / 10000)::bigint;
    else
      -- Default to percentage of base net commission
      v_pool := v_pool - round(v_net::numeric * v_line.rate_bps / 10000)::bigint;
    end if;
  end loop;

  v_office := round(v_pool::numeric * v_rule.office_share_bps / 10000)::bigint;
  v_agent_pool := v_pool - v_office;

  update public.commission_calculation set status = 'archived' where deal_id = p_deal_id and status = 'provisional';

  insert into public.commission_calculation (deal_id, rule_set_id, calculated_by, gross_cents, vat_cents, net_cents, franchise_fee_cents, distributable_pool_cents, office_share_cents, agent_pool_cents, input_snapshot_json, status)
  values (
    p_deal_id, v_rule.id, public.get_current_user_account_id(),
    v_gross, v_vat, v_net, v_franchise_fee, v_pool, v_office, v_agent_pool,
    jsonb_build_object(
      'sale_price', v_deal.sale_price_cents,
      'comm_rate_bps', coalesce(nullif(v_mandate.commission_rate_bps, 0), v_rule.default_commission_rate_bps),
      'vat_treatment', v_rule.vat_treatment,
      'franchise_fee_pct', v_branch_fee_pct,
      'office_share_bps', v_rule.office_share_bps,
      'rule_lines', coalesce((select jsonb_agg(to_jsonb(line) order by line.sequence) from public.commission_rule_line line where line.rule_set_id = v_rule.id), '[]'::jsonb)),
    'provisional'
  ) returning id into v_calc_id;

  for v_participant in select * from public.deal_participant where deal_id = p_deal_id order by is_external desc, created_at asc loop
    if v_participant.split_type = 'percentage' then
      v_allocation := round(v_agent_pool::numeric * v_participant.split_value / 100)::bigint;
    else
      v_allocation := v_participant.split_value;
    end if;
    v_advance := 0;
    if not v_participant.is_external then
      select coalesce(sum(amount_cents), 0) into v_advance from public.commission_advance where user_account_id = v_participant.user_account_id and deal_id = p_deal_id;
    end if;
    insert into public.commission_allocation (calculation_id, user_account_id, external_payee_name, allocation_type, gross_allocation_cents, desk_fee_cents, advance_recovery_cents, net_payable_cents)
    values (v_calc_id, v_participant.user_account_id, v_participant.external_payee_name, 'primary_split', v_allocation, 0, v_advance, v_allocation - v_advance);
    v_allocated := v_allocated + v_allocation;
  end loop;

  if v_allocated > v_agent_pool then raise exception 'Allocations (%) exceed the agent pool (%). Check fixed allocations.', v_allocated, v_agent_pool; end if;
  return v_calc_id;
end;
$$;

create or replace function public.transition_deal(
  p_deal_id uuid,
  p_to_stage public.deal_stage,
  p_reason text default null,
  p_override boolean default false
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_actor uuid := public.get_current_user_account_id();
  v_stages public.deal_stage[] := array[
    'mandate_signed', 'listed_marketing', 'offer_received', 'otp_signed',
    'suspensive_conditions_pending', 'conveyancer_instructed', 'compliance_certificates',
    'transfer_duty_vat', 'rates_levy_clearance', 'documents_signed_guarantees',
    'lodged', 'registered', 'commission_released'
  ]::public.deal_stage[];
  v_from_index int;
  v_to_index int;
  v_gate_failure text;
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  select * into v_deal from public.deal where id = p_deal_id for update;
  if v_deal.status not in ('active', 'registered') then raise exception 'A closed deal cannot be transitioned.'; end if;
  v_from_index := array_position(v_stages, v_deal.stage);
  v_to_index := array_position(v_stages, p_to_stage);
  if abs(v_to_index - v_from_index) <> 1 and not p_override then
    raise exception 'Deals can move only one stage at a time.';
  end if;
  if v_to_index < v_from_index and nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required when reverting a deal.';
  end if;
  if p_override and public.get_current_role() not in ('admin', 'admin_agent') then
    raise exception 'Only an administrator can override a stage gate.';
  end if;

  if v_to_index > v_from_index then
    case v_deal.stage
      when 'mandate_signed' then
        if not exists (select 1 from public.mandate m where m.id = v_deal.mandate_id and m.signed_on is not null and m.expires_on is not null)
        then v_gate_failure := 'Signed mandate and expiry are required.'; end if;
      when 'offer_received' then
        if not exists (select 1 from public.offer o where o.deal_id = p_deal_id)
        then v_gate_failure := 'At least one offer must be captured.'; end if;
      when 'otp_signed' then
        if v_deal.sale_price_cents <= 0 or v_deal.otp_signed_on is null
        then v_gate_failure := 'Purchase price and OTP date are required.'; end if;
        if not exists (select 1 from public.document doc where doc.deal_id = p_deal_id and doc.category = 'mandate')
          or not exists (select 1 from public.document doc where doc.deal_id = p_deal_id and doc.category = 'otp')
        then v_gate_failure := 'Signed mandate and signed OTP documents are required.'; end if;
      when 'suspensive_conditions_pending' then
        if exists (select 1 from public.suspensive_condition c where c.deal_id = p_deal_id and c.status in ('pending', 'extended'))
        then v_gate_failure := 'All suspensive conditions must be fulfilled or waived.'; end if;
      when 'conveyancer_instructed' then
        if v_deal.conveyancer_firm_id is null
        then v_gate_failure := 'A conveyancer must be appointed.'; end if;
      else null;
    end case;
  end if;
  if v_gate_failure is not null and not p_override then raise exception '%', v_gate_failure; end if;

  perform set_config('app.workflow_change', 'allowed', true);
  update public.deal set
    stage = p_to_stage,
    status = case when p_to_stage = 'registered' then 'registered' else status end,
    registration_date = case when p_to_stage = 'registered' then coalesce(registration_date, current_date) else registration_date end
  where id = p_deal_id;

  insert into public.deal_stage_history(deal_id, from_stage, to_stage, changed_by, reason, is_override)
  values (p_deal_id, v_deal.stage, p_to_stage, v_actor, p_reason, p_override);
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (
    v_deal.agency_id, v_actor, 'deal', p_deal_id, 'stage_transition',
    jsonb_build_object('stage', v_deal.stage), jsonb_build_object('stage', p_to_stage, 'override', p_override, 'reason', p_reason)
  );
  if p_to_stage = 'registered' then
    perform public.calculate_deal_commission(p_deal_id, null, p_override);
  end if;
end;
$$;

revoke all on function public.calculate_deal_commission(uuid, uuid, boolean) from public, anon;
grant execute on function public.calculate_deal_commission(uuid, uuid, boolean) to authenticated;
revoke all on function public.transition_deal(uuid, public.deal_stage, text, boolean) from public, anon;
grant execute on function public.transition_deal(uuid, public.deal_stage, text, boolean) to authenticated;
