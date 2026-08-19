-- Same NULL-role bypass class as 20260819140000: the old guard combined
-- p_override with an uncoalesced role comparison, which evaluates to NULL
-- (not true) when get_current_role() returns NULL -- a suspended agent
-- whose JWT is still valid, or an account with no accepted invitation -- so
-- the override guard silently fell through instead of raising, letting such
-- a caller bypass a deal's stage-gate requirements. Only the guard line
-- changes; the rest of the body is unchanged from what is live today.

create or replace function public.transition_deal(
  p_deal_id uuid,
  p_to_stage public.deal_stage,
  p_reason text default null,
  p_override boolean default false
)
returns void
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
  if p_override and coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
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
