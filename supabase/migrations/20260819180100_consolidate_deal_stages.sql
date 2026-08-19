-- Second half of the 13->7 stage consolidation (see 20260819180000 for the
-- enum values and rationale). This migration:
--   1. Backfills existing public.deal rows onto the two new consolidated
--      values.
--   2. Moves the deal.stage column default onto the new starting stage.
--   3. Rewrites transition_deal for the 7-stage pipeline, merging gate
--      checks from the stages that got folded together (a deal can't
--      reach otp_signed without both a signed mandate and a captured
--      offer; can't reach lodged without an appointed conveyancer) --
--      every check that existed before still runs, just against the new
--      stage names.
--   4. Rewrites submit_conveyancer_status, which transitioned a deal
--      directly from documents_signed_guarantees to lodged outside of
--      transition_deal; it now does the same from conveyancing.
-- deal_stage_history is never rewritten -- historical rows keep whatever
-- stage name was actually current at the time, which is the accurate
-- record of what happened.

update public.deal
set stage = 'listing_negotiation'
where stage in ('mandate_signed', 'listed_marketing', 'offer_received');

update public.deal
set stage = 'conveyancing'
where stage in (
  'conveyancer_instructed', 'compliance_certificates', 'transfer_duty_vat',
  'rates_levy_clearance', 'documents_signed_guarantees'
);

alter table public.deal alter column stage set default 'listing_negotiation';

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
    'listing_negotiation', 'otp_signed', 'suspensive_conditions_pending',
    'conveyancing', 'lodged', 'registered', 'commission_released'
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
      when 'listing_negotiation' then
        if not exists (select 1 from public.mandate m where m.id = v_deal.mandate_id and m.signed_on is not null and m.expires_on is not null)
        then v_gate_failure := 'Signed mandate and expiry are required.';
        elsif not exists (select 1 from public.offer o where o.deal_id = p_deal_id)
        then v_gate_failure := 'At least one offer must be captured.';
        end if;
      when 'otp_signed' then
        if v_deal.sale_price_cents <= 0 or v_deal.otp_signed_on is null
        then v_gate_failure := 'Purchase price and OTP date are required.'; end if;
        if not exists (select 1 from public.document doc where doc.deal_id = p_deal_id and doc.category = 'mandate')
          or not exists (select 1 from public.document doc where doc.deal_id = p_deal_id and doc.category = 'otp')
        then v_gate_failure := 'Signed mandate and signed OTP documents are required.'; end if;
      when 'suspensive_conditions_pending' then
        if exists (select 1 from public.suspensive_condition c where c.deal_id = p_deal_id and c.status in ('pending', 'extended'))
        then v_gate_failure := 'All suspensive conditions must be fulfilled or waived.'; end if;
      when 'conveyancing' then
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

create or replace function public.submit_conveyancer_status(p_token text, p_lodged_on date)
returns void
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_request public.status_request_token%rowtype;
  v_deal public.deal%rowtype;
begin
  if not public.check_rate_limit('submit_conveyancer_status:' || p_token, 10, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;
  if p_lodged_on is null or p_lodged_on > current_date then
    raise exception 'A valid lodgement date on or before today is required.';
  end if;
  select * into v_request from public.status_request_token
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;
  if v_request.id is null or v_request.used_at is not null or v_request.expires_at <= now() then
    raise exception 'This status link is invalid, expired, or already used.';
  end if;
  select * into v_deal from public.deal where id = v_request.deal_id for update;
  if v_deal.status <> 'active' then raise exception 'This deal is no longer active.'; end if;
  perform set_config('app.workflow_change', 'allowed', true);
  update public.deal set lodged_on = p_lodged_on,
    stage = case when stage = 'conveyancing' then 'lodged' else stage end
  where id = v_deal.id;
  update public.status_request_token set used_at = now() where id = v_request.id;
  if v_deal.stage = 'conveyancing' then
    insert into public.deal_stage_history(deal_id, from_stage, to_stage, changed_by_external_email, reason)
    values (v_deal.id, v_deal.stage, 'lodged', v_request.recipient_email, 'Conveyancer confirmed lodgement');
  end if;
  insert into public.audit_log(agency_id, entity_type, entity_id, action, before_json, after_json)
  values (
    v_deal.agency_id, 'deal', v_deal.id, 'stage_transition',
    jsonb_build_object('stage', v_deal.stage),
    jsonb_build_object('stage', case when v_deal.stage = 'conveyancing' then 'lodged' else v_deal.stage end,
      'lodged_on', p_lodged_on, 'submitted_by', v_request.recipient_email)
  );
  insert into public.notification(
    agency_id, user_account_id, channel, subject, body, related_entity_type,
    related_entity_id, scheduled_for
  )
  select distinct v_deal.agency_id, recipient.id, 'in_app', 'Conveyancer status received',
    'Lodgement date ' || p_lodged_on::text || ' submitted for deal ' || v_deal.reference,
    'deal', v_deal.id, now()
  from public.deal_participant recipient
  where recipient.deal_id = v_deal.id;
end;
$$;
