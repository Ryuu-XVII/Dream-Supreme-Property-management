-- submit_conveyancer_status() only notified the deal's participants, so an
-- admin who wasn't one of them missed conveyancer lodgement updates. Admins
-- should see everything happening across the agency's deals, same as every
-- other deal notification.
create or replace function public.submit_conveyancer_status(p_token text, p_lodged_on date)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
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
  from public.user_account recipient
  where recipient.agency_id = v_deal.agency_id
    and (
      recipient.role in ('admin', 'admin_agent')
      or exists (
        select 1 from public.deal_participant dp
        where dp.deal_id = v_deal.id and dp.user_account_id = recipient.id and dp.is_external = false
      )
    );
end;
$function$;
