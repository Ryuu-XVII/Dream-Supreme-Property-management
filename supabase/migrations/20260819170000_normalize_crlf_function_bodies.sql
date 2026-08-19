-- Root cause of the persistently-failing "Check live schema matches
-- migrations" CI job: these 7 functions were, at some point, applied
-- directly to production from a Windows checkout and got their bodies
-- stored with literal CRLF (\r\n) line endings. A migration replay on the
-- Linux CI runner produces LF-only bodies for the same logic, so
-- `supabase db diff` correctly reported a real (if purely cosmetic)
-- byte-level difference on every single run since the drift check was
-- introduced -- this was never a false positive, and it never reproduced
-- locally on Windows because the local shadow database ended up with the
-- same CRLF bytes either way. Re-declaring each with identical logic and
-- LF-only line endings (this file, like the rest of the repo, is LF) makes
-- the stored body match what any future migration replay produces on any
-- platform.

create or replace function public.cancel_deal(p_deal_id uuid, p_reason cancellation_reason, p_notes text default null::text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_actor uuid := public.get_current_user_account_id();
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  select * into v_deal from public.deal where id = p_deal_id for update;
  if p_reason = 'other' and nullif(trim(p_notes), '') is null then raise exception 'Notes are required for Other.'; end if;
  perform set_config('app.workflow_change', 'allowed', true);
  update public.deal set status = 'cancelled', cancellation_reason = p_reason,
    cancellation_notes = p_notes, cancelled_on = current_date where id = p_deal_id;
  insert into public.commission_clawback(calculation_id, user_account_id, amount_cents, reason, raised_on)
  select cc.id, ca.user_account_id, ca.net_payable_cents,
    'Deal cancelled: ' || p_reason::text || coalesce(' - ' || nullif(trim(p_notes), ''), ''), current_date
  from public.commission_calculation cc
  join public.commission_allocation ca on ca.calculation_id = cc.id
  where cc.deal_id = p_deal_id and cc.status = 'confirmed' and ca.user_account_id is not null
    and ca.net_payable_cents > 0
    and cc.calculated_at = (
      select max(latest.calculated_at) from public.commission_calculation latest
      where latest.deal_id = p_deal_id and latest.status = 'confirmed'
    );
  update public.commission_calculation set status = 'reversed'
  where deal_id = p_deal_id and status in ('provisional', 'confirmed');
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (v_deal.agency_id, v_actor, 'deal', p_deal_id, 'update',
    jsonb_build_object('status', v_deal.status), jsonb_build_object('status', 'cancelled', 'reason', p_reason, 'notes', p_notes));
end;
$$;

create or replace function public.create_status_request(p_deal_id uuid, p_recipient_email text, p_expires_in_hours integer default 72)
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  if nullif(trim(p_recipient_email), '') is null then raise exception 'Recipient email is required.'; end if;
  if p_expires_in_hours < 1 or p_expires_in_hours > 168 then raise exception 'Expiry must be between 1 and 168 hours.'; end if;
  insert into public.status_request_token(deal_id, recipient_email, token_hash, expires_at)
  values (
    p_deal_id, lower(trim(p_recipient_email)), encode(digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(hours => p_expires_in_hours)
  );
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  select d.agency_id, public.get_current_user_account_id(), 'status_request_token', d.id, 'create',
    jsonb_build_object('recipient_email', lower(trim(p_recipient_email)), 'expires_in_hours', p_expires_in_hours)
  from public.deal d where d.id = p_deal_id;
  return v_token;
end;
$$;

create or replace function public.enforce_deal_workflow()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.stage, old.status, old.cancellation_reason, old.cancelled_on)
     is distinct from
     (new.stage, new.status, new.cancellation_reason, new.cancelled_on)
     and coalesce(current_setting('app.workflow_change', true), '') <> 'allowed'
  then
    raise exception 'Use the deal workflow functions to transition or cancel a deal.';
  end if;
  return new;
end;
$$;

create or replace function public.get_current_role()
returns user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.user_account
  where auth_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.log_audit_event(p_entity_type text, p_entity_id uuid, p_action text, p_summary text, p_after_json jsonb default null::jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_agency_id uuid;
begin
  select agency_id into v_agency_id from public.user_account where auth_user_id = auth.uid()::uuid;
  if v_agency_id is null then
    raise exception 'Not authorized';
  end if;

  insert into public.audit_log(
    agency_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    after_json
  ) values (
    v_agency_id,
    auth.uid()::uuid,
    p_entity_type,
    p_entity_id,
    p_action,
    jsonb_build_object('summary', p_summary) || coalesce(p_after_json, '{}'::jsonb)
  );
end;
$$;

create or replace function public.set_bond_status(p_deal_id uuid, p_status bond_app_status, p_institution text default null::text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  insert into public.bond_application(deal_id, institution, status, status_updated_on)
  values (p_deal_id, coalesce(nullif(trim(p_institution), ''), 'Not specified'), p_status, current_date)
  on conflict (deal_id) do update set
    status = excluded.status,
    institution = coalesce(nullif(trim(p_institution), ''), public.bond_application.institution),
    status_updated_on = current_date;
end;
$$;

create or replace function public.set_condition_status(p_condition_id uuid, p_status condition_status, p_new_due_on date default null::date, p_reason text default null::text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_condition public.suspensive_condition%rowtype;
  v_agency uuid;
begin
  select c.* into v_condition from public.suspensive_condition c where c.id = p_condition_id for update;
  if v_condition.id is null or not public.can_access_deal(v_condition.deal_id) then raise exception 'Condition not found or access denied.'; end if;
  if p_status = 'extended' and (p_new_due_on is null or nullif(trim(p_reason), '') is null) then
    raise exception 'A new due date and reason are required for an extension.';
  end if;
  update public.suspensive_condition set
    status = p_status,
    due_on = case when p_status = 'extended' then p_new_due_on else due_on end,
    extension_reason = case when p_status = 'extended' then p_reason else extension_reason end,
    fulfilled_on = case when p_status = 'fulfilled' then current_date else fulfilled_on end
  where id = p_condition_id;
  select agency_id into v_agency from public.deal where id = v_condition.deal_id;
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (v_agency, public.get_current_user_account_id(), 'condition', p_condition_id, 'update',
    to_jsonb(v_condition), jsonb_build_object('status', p_status, 'due_on', coalesce(p_new_due_on, v_condition.due_on), 'reason', p_reason));
end;
$$;
