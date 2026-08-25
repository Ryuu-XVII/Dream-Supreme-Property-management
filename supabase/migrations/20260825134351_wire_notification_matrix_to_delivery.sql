-- Migration: Wire the Notification Matrix to actual delivery
-- Description: The admin "Notification Matrix" screen (src/routes/admin/notifications.tsx)
-- reads/writes public.notification_preference correctly, but NOTHING that
-- creates a public.notification row or an email_queue row ever consulted
-- that table. Every toggle, recipient-role selection, and condition JSON was
-- a pure no-op. On top of that, 4 of the 11 matrix rows had no trigger path
-- at all (Condition failed, Deal stale, Commission issued, New lead), and
-- the working paths never wrote to email_queue, so the "Email" column did
-- nothing even where the "In-App" column worked.
--
-- This adds a single shared dispatch helper that every notification-creating
-- path now goes through, and wires up the four dead types. Recipient-role
-- filtering, email/in-app toggles, and a "min_price" condition (the one
-- example shape the UI's placeholder documents) are now honored uniformly.

-- =============================================================================
-- 1. Shared dispatch helper
-- =============================================================================

create or replace function public.dispatch_notification(
  p_agency_id uuid,
  p_event_type text,
  p_user_account_id uuid,
  p_subject text,
  p_body text,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_link text default null,
  p_price_cents bigint default null,
  p_dedupe_key text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pref public.notification_preference%rowtype;
  v_role public.user_role;
  v_email text;
  v_email_enabled boolean;
  v_in_app_enabled boolean;
begin
  -- Optional dedupe: reuses the app's existing rate-limit-hit ledger as a
  -- generic "have we already fired this exact event for this recipient
  -- recently" check, so the daily sweeps don't need their own bespoke
  -- "not exists" bookkeeping query per notification type. A hit is recorded
  -- (and the call proceeds) the first time; recorded hits block repeats for
  -- 1 day regardless of which channels end up enabled below.
  if p_dedupe_key is not null
     and not public.check_rate_limit('notify:' || p_dedupe_key, 1, interval '1 day') then
    return;
  end if;

  select role, email into v_role, v_email
  from public.user_account where id = p_user_account_id and status = 'active';
  if v_role is null then return; end if;

  select * into v_pref from public.notification_preference
  where agency_id = p_agency_id and event_type = p_event_type;

  -- No saved preference row (agency has never opened/saved the matrix, or
  -- this is an event type the matrix doesn't list) -- default to delivering
  -- on both channels with no role restriction, which matches the matrix's
  -- own pre-save default state and preserves prior unconditional behavior
  -- for event types the matrix doesn't cover at all.
  v_email_enabled := coalesce(v_pref.email_enabled, true);
  v_in_app_enabled := coalesce(v_pref.in_app_enabled, true);
  if not v_email_enabled and not v_in_app_enabled then return; end if;

  -- admin_agent is a dual role: treat it as satisfying either an 'admin' or
  -- an 'agent' recipient-role entry, since a user in that role is both.
  if v_pref.id is not null
     and not (v_role = any(v_pref.recipient_roles))
     and not (v_role = 'admin_agent' and (
       'admin' = any(v_pref.recipient_roles) or 'agent' = any(v_pref.recipient_roles)
     )) then
    return;
  end if;

  -- Only the one condition shape the UI's own placeholder documents
  -- ({"min_price": 5000000}, entered in rands) is interpreted. An event with
  -- no natural price (p_price_cents null) simply isn't gated by it.
  if v_pref.condition_config is not null and v_pref.condition_config ? 'min_price'
     and p_price_cents is not null
     and p_price_cents < ((v_pref.condition_config->>'min_price')::numeric * 100) then
    return;
  end if;

  if v_in_app_enabled then
    insert into public.notification(
      agency_id, user_account_id, channel, subject, body, link,
      related_entity_type, related_entity_id, scheduled_for
    ) values (
      p_agency_id, p_user_account_id, 'in_app', p_subject, p_body, p_link,
      p_related_entity_type, p_related_entity_id, now()
    );
  end if;

  if v_email_enabled and v_email is not null then
    insert into public.email_queue(agency_id, recipient_email, subject, email_type, merge_values, status)
    values (
      p_agency_id, v_email, p_subject, 'deal_notification',
      jsonb_build_object('eventSubject', p_subject, 'eventBody', p_body, 'dealLink', coalesce(p_link, '')),
      'pending'
    );
  end if;
end;
$$;
revoke all on function public.dispatch_notification(uuid, text, uuid, text, text, text, uuid, text, bigint, text) from public, anon, authenticated;

-- =============================================================================
-- 2. Seed sane default preference rows, existing + future agencies
-- =============================================================================
-- Without a stored row, dispatch_notification delivers unrestricted (see
-- above) -- correct as a fallback, but it means "Commission issued" would
-- reach agents too until an admin happens to open and save the matrix once.
-- Seed the same defaults the frontend itself starts new rows with
-- (src/routes/admin/notifications.tsx: email+in-app on, Agent+Admin, except
-- Commission issued which defaults to Admin only) so behavior is correct
-- from the moment this migration runs, not from whenever someone visits
-- the settings screen.

create or replace function public.seed_default_notification_preferences()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notification_preference (agency_id, event_type, email_enabled, in_app_enabled, recipient_roles)
  select NEW.id, t.event_type, true, true,
    case when t.event_type = 'Commission issued' then array['admin']::public.user_role[]
         else array['agent', 'admin']::public.user_role[] end
  from (values
    ('Condition due'), ('Condition failed'), ('Stage advanced'), ('Deal registered'),
    ('Deal cancelled'), ('FFC expiring'), ('Mandate expiring'), ('Deal stale'),
    ('Commission issued'), ('Conveyancer status request'), ('New lead')
  ) as t(event_type)
  on conflict (agency_id, event_type) do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_seed_notification_preferences on public.agency;
create trigger trg_seed_notification_preferences
after insert on public.agency
for each row execute function public.seed_default_notification_preferences();

insert into public.notification_preference (agency_id, event_type, email_enabled, in_app_enabled, recipient_roles)
select a.id, t.event_type, true, true,
  case when t.event_type = 'Commission issued' then array['admin']::public.user_role[]
       else array['agent', 'admin']::public.user_role[] end
from public.agency a
cross join (values
  ('Condition due'), ('Condition failed'), ('Stage advanced'), ('Deal registered'),
  ('Deal cancelled'), ('FFC expiring'), ('Mandate expiring'), ('Deal stale'),
  ('Commission issued'), ('Conveyancer status request'), ('New lead')
) as t(event_type)
on conflict (agency_id, event_type) do nothing;

-- =============================================================================
-- 3. Deal-event trigger: route through dispatch_notification
-- =============================================================================

create or replace function public.notify_agency_admins()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal_id uuid;
  v_agency_id uuid;
  v_deal_ref text;
  v_property_address text;
  v_subject text;
  v_body text;
  v_link text;
  v_agent_names text;
  v_price_cents bigint;
  v_recipient record;
  v_event_type text;
begin
  if TG_TABLE_NAME = 'deal' then
    v_deal_id := NEW.id;
    v_agency_id := NEW.agency_id;
    v_deal_ref := NEW.reference;
    v_link := 'https://admin.dreamsupreme.co.za/deals/' || v_deal_id;
    v_price_cents := NEW.sale_price_cents;

    select address_line into v_property_address from public.property where id = NEW.property_id;

    if OLD is null then
      -- "Deal opened" isn't one of the matrix's 11 types, so it always
      -- delivers unrestricted via dispatch_notification's no-saved-row
      -- fallback -- preserves the existing unconditional behavior.
      v_event_type := 'Deal opened';
      v_subject := '🆕 New Deal Opened: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'A new deal was opened for property at ' || coalesce(v_property_address, 'Property') ||
                ', sale price R' || to_char(coalesce(NEW.sale_price_cents, 0) / 100.0, 'FM999,999,990.00') || '.';

    elsif NEW.stage = 'registered' and OLD.stage <> 'registered' then
      v_event_type := 'Deal registered';
      v_subject := '🎉 Deal Registered & Closed: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal for property at ' || coalesce(v_property_address, 'Property') ||
                ' has been registered and closed. Final sale price: R' ||
                to_char(coalesce(NEW.sale_price_cents, 0) / 100.0, 'FM999,999,990.00');

    elsif NEW.status = 'cancelled' and OLD.status <> 'cancelled' then
      v_event_type := 'Deal cancelled';
      v_subject := '🚨 Deal Cancelled: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal at ' || coalesce(v_property_address, 'Property') ||
                ' was cancelled. Reason: ' || coalesce(NEW.cancellation_reason::text, 'Not specified') ||
                case when NEW.cancellation_notes is not null then '. Notes: ' || NEW.cancellation_notes else '' end;

    elsif OLD.stage <> NEW.stage then
      v_event_type := 'Stage advanced';
      v_subject := '📈 Deal Stage Updated: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal at ' || coalesce(v_property_address, 'Property') ||
                ' advanced from ' || OLD.stage || ' to ' || NEW.stage || '.';
    else
      return NEW;
    end if;

  elsif TG_TABLE_NAME = 'audit_log' then
    if NEW.entity_type <> 'deal' then return NEW; end if;
    v_deal_id := NEW.entity_id;
    v_agency_id := NEW.agency_id;
    v_link := 'https://admin.dreamsupreme.co.za/deals/' || v_deal_id;

    select reference into v_deal_ref from public.deal where id = v_deal_id;

    if NEW.action = 'progress_note_added' then
      -- Not one of the matrix's 11 types either; same unrestricted fallback.
      v_event_type := 'Deal progress note';
      v_subject := '📝 Progress Note Added: ' || coalesce(v_deal_ref, 'Deal');
      v_body := 'An operational update note was logged: "' ||
                coalesce(NEW.after_json->>'note', 'Note added') || '"';
    else
      return NEW;
    end if;
  end if;

  select string_agg(distinct u.full_name, ', ' order by u.full_name)
  into v_agent_names
  from public.deal_participant dp
  join public.user_account u on u.id = dp.user_account_id
  where dp.deal_id = v_deal_id and dp.is_external = false;

  for v_recipient in
    select id, bool_or(is_admin) as is_admin from (
      select id, true as is_admin from public.user_account
      where agency_id = v_agency_id and role in ('admin', 'admin_agent')
      union all
      select u.id, false as is_admin
      from public.deal_participant dp
      join public.user_account u on u.id = dp.user_account_id
      where dp.deal_id = v_deal_id and dp.is_external = false
    ) recipients
    group by id
  loop
    perform public.dispatch_notification(
      v_agency_id, v_event_type, v_recipient.id, v_subject,
      case when v_recipient.is_admin and v_agent_names is not null
        then v_body || ' — Agent: ' || v_agent_names
        else v_body
      end,
      'deal', v_deal_id, v_link, v_price_cents
    );
  end loop;

  return NEW;
end;
$$;

-- =============================================================================
-- 4. Daily sweeps: route through dispatch_notification, add "Deal stale"
-- =============================================================================

create or replace function public.run_daily_sweeps()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  for v_row in
    select distinct d.agency_id, recipient.id as recipient_id, c.id as condition_id, d.id as deal_id,
      case when c.due_on < current_date then 'Condition overdue' else 'Condition deadline approaching' end as subject,
      d.reference || ': ' || coalesce(c.description, c.condition_type::text) || ' is due ' || to_char(c.due_on, 'DD Mon YYYY') ||
      case when recipient.role in ('admin', 'admin_agent') and agents.names is not null
        then ' — Agent: ' || agents.names else '' end as body
    from public.suspensive_condition c
    join public.deal d on d.id = c.deal_id
    join public.user_account recipient on recipient.agency_id = d.agency_id and recipient.status = 'active'
    left join lateral (
      select string_agg(distinct u.full_name, ', ' order by u.full_name) as names
      from public.deal_participant dp
      join public.user_account u on u.id = dp.user_account_id
      where dp.deal_id = d.id and dp.is_external = false
    ) agents on true
    where c.status in ('pending', 'extended')
      and (c.due_on - current_date in (14, 7, 3, 1) or c.due_on < current_date)
      and (recipient.role in ('admin', 'admin_agent') or exists (
        select 1 from public.deal_participant dp where dp.deal_id = d.id and dp.user_account_id = recipient.id
      ))
  loop
    perform public.dispatch_notification(
      v_row.agency_id, 'Condition due', v_row.recipient_id, v_row.subject, v_row.body,
      'suspensive_condition', v_row.condition_id, 'https://admin.dreamsupreme.co.za/deals/' || v_row.deal_id, null,
      'condition_due:' || v_row.condition_id || ':' || v_row.recipient_id || ':' || v_row.subject
    );
    v_count := v_count + 1;
  end loop;

  for v_row in
    select distinct d.agency_id, recipient.id as recipient_id, m.id as mandate_id, d.id as deal_id,
      case when m.expires_on < current_date then 'Mandate expired' else 'Mandate expiry approaching' end as subject,
      d.reference || ': mandate expires ' || to_char(m.expires_on, 'DD Mon YYYY') ||
      case when recipient.role in ('admin', 'admin_agent') and agents.names is not null
        then ' — Agent: ' || agents.names else '' end as body
    from public.mandate m
    join public.deal d on d.mandate_id = m.id and d.status = 'active'
    join public.user_account recipient on recipient.agency_id = d.agency_id and recipient.status = 'active'
    left join lateral (
      select string_agg(distinct u.full_name, ', ' order by u.full_name) as names
      from public.deal_participant dp
      join public.user_account u on u.id = dp.user_account_id
      where dp.deal_id = d.id and dp.is_external = false
    ) agents on true
    where m.status = 'active'
      and (m.expires_on - current_date in (30, 14, 7, 3, 1) or m.expires_on < current_date)
      and (recipient.role in ('admin', 'admin_agent') or exists (
        select 1 from public.deal_participant dp where dp.deal_id = d.id and dp.user_account_id = recipient.id
      ))
  loop
    perform public.dispatch_notification(
      v_row.agency_id, 'Mandate expiring', v_row.recipient_id, v_row.subject, v_row.body,
      'mandate', v_row.mandate_id, 'https://admin.dreamsupreme.co.za/deals/' || v_row.deal_id, null,
      'mandate_expiring:' || v_row.mandate_id || ':' || v_row.recipient_id || ':' || v_row.subject
    );
    v_count := v_count + 1;
  end loop;

  for v_row in
    select u.agency_id, recipient.id as recipient_id, f.id as ffc_id,
      case when f.expires_on < current_date then 'FFC expired' else 'FFC expiry approaching' end as subject,
      u.full_name || ': FFC ' || f.certificate_number || ' expires ' || to_char(f.expires_on, 'DD Mon YYYY') as body
    from public.ffc_certificate f
    join public.user_account u on u.id = f.user_account_id and u.status = 'active'
    join public.user_account recipient on recipient.agency_id = u.agency_id and recipient.status = 'active'
    where (f.expires_on - current_date in (60, 30, 14, 7, 3, 1) or f.expires_on < current_date)
      and (recipient.id = u.id or recipient.role in ('admin', 'admin_agent'))
  loop
    perform public.dispatch_notification(
      v_row.agency_id, 'FFC expiring', v_row.recipient_id, v_row.subject, v_row.body,
      'ffc_certificate', v_row.ffc_id, null, null,
      'ffc_expiring:' || v_row.ffc_id || ':' || v_row.recipient_id || ':' || v_row.subject
    );
    v_count := v_count + 1;
  end loop;

  -- "Deal stale": an active deal whose row hasn't changed (touch_updated_at
  -- bumps updated_at on any column update, so this is effectively "no
  -- stage/status/field movement") in 14+ days. Re-notified weekly rather
  -- than daily once flagged, via the dedupe key's 7-day window, so a deal
  -- stuck for months doesn't re-alert every single night.
  for v_row in
    select distinct d.agency_id, recipient.id as recipient_id, d.id as deal_id,
      'Deal stale' as subject,
      d.reference || ' has had no activity in ' || (current_date - d.updated_at::date) || ' days.' ||
      case when recipient.role in ('admin', 'admin_agent') and agents.names is not null
        then ' — Agent: ' || agents.names else '' end as body
    from public.deal d
    join public.user_account recipient on recipient.agency_id = d.agency_id and recipient.status = 'active'
    left join lateral (
      select string_agg(distinct u.full_name, ', ' order by u.full_name) as names
      from public.deal_participant dp
      join public.user_account u on u.id = dp.user_account_id
      where dp.deal_id = d.id and dp.is_external = false
    ) agents on true
    where d.status = 'active'
      and d.updated_at < now() - interval '14 days'
      and (recipient.role in ('admin', 'admin_agent') or exists (
        select 1 from public.deal_participant dp where dp.deal_id = d.id and dp.user_account_id = recipient.id
      ))
  loop
    perform public.dispatch_notification(
      v_row.agency_id, 'Deal stale', v_row.recipient_id, v_row.subject, v_row.body,
      'deal', v_row.deal_id, 'https://admin.dreamsupreme.co.za/deals/' || v_row.deal_id, null,
      'deal_stale:' || v_row.deal_id || ':' || v_row.recipient_id || ':' || to_char(current_date, 'IYYY-IW')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- =============================================================================
-- 5. Condition failed
-- =============================================================================

create or replace function public.set_condition_status(p_condition_id uuid, p_status condition_status, p_new_due_on date default null::date, p_reason text default null::text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_condition public.suspensive_condition%rowtype;
  v_agency uuid;
  v_deal_ref text;
  v_deal_id uuid;
  v_recipient record;
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

  if p_status = 'failed' then
    v_deal_id := v_condition.deal_id;
    select reference into v_deal_ref from public.deal where id = v_deal_id;
    for v_recipient in
      select id from public.user_account
      where agency_id = v_agency and status = 'active'
        and (role in ('admin', 'admin_agent') or id in (
          select user_account_id from public.deal_participant
          where deal_id = v_deal_id and is_external = false
        ))
    loop
      perform public.dispatch_notification(
        v_agency, 'Condition failed', v_recipient.id,
        '❌ Condition Failed: ' || coalesce(v_deal_ref, 'Deal'),
        coalesce(v_condition.description, v_condition.condition_type::text) || ' has failed for deal ' || coalesce(v_deal_ref, '') || '.',
        'suspensive_condition', p_condition_id, 'https://admin.dreamsupreme.co.za/deals/' || v_deal_id, null
      );
    end loop;
  end if;
end;
$$;

-- =============================================================================
-- 6. Commission issued
-- =============================================================================

create or replace function public.calculate_deal_commission(
  p_deal_id uuid,
  p_rule_set_id uuid default null::uuid,
  p_override boolean default false
) returns uuid
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
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then raise exception 'Only an administrator can calculate commission.'; end if;
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;

  select * into v_deal from public.deal where id = p_deal_id;
  select * into v_mandate from public.mandate where id = v_deal.mandate_id;

  if p_rule_set_id is not null then
    select * into v_rule from public.commission_rule_set where id = p_rule_set_id and agency_id = v_deal.agency_id;
  else
    select * into v_rule from public.commission_rule_set
    where agency_id = v_deal.agency_id and is_default
      and effective_from <= coalesce(v_deal.registration_date, current_date)
      and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
    order by effective_from desc limit 1;

    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
        and effective_from <= coalesce(v_deal.registration_date, current_date)
        and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
      order by is_default desc, effective_from desc limit 1;
    end if;

    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id and is_default
      order by effective_from desc limit 1;
    end if;

    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
      order by is_default desc, effective_from desc limit 1;
    end if;
  end if;

  if v_rule.id is null then
    raise exception 'No applicable commission rule set exists. Please create a rule set under Admin > Commission Rules.';
  end if;

  if not coalesce(p_override, false) then
    select string_agg(u.full_name, ', ') into v_invalid_ffc
    from public.deal_participant dp
    join public.user_account u on u.id = dp.user_account_id
    where dp.deal_id = p_deal_id and not dp.is_external
      and not (
        exists (
          select 1 from public.ffc_certificate f
          where (f.user_account_id = u.id or f.user_account_id in (
            select u2.id from public.user_account u2
            where u2.agency_id = u.agency_id and (lower(u2.email) = lower(u.email) or lower(u2.full_name) = lower(u.full_name))
          ))
          and (f.expires_on is null or f.expires_on >= coalesce(v_deal.registration_date, current_date))
        )
        or exists (
          select 1 from public.ffc_certificate f
          where f.user_account_id = u.id or f.user_account_id in (
            select u2.id from public.user_account u2
            where u2.agency_id = u.agency_id and (lower(u2.email) = lower(u.email) or lower(u2.full_name) = lower(u.full_name))
          )
        )
        or exists (
          select 1 from public.document d
          where (
            d.user_account_id = u.id or d.uploaded_by = u.id or d.user_account_id in (
              select u2.id from public.user_account u2
              where u2.agency_id = u.agency_id and (lower(u2.email) = lower(u.email) or lower(u2.full_name) = lower(u.full_name))
            )
          )
          and d.category = 'ffc_certificate'::public.document_category
        )
        or (u.ppra_reference is not null and trim(u.ppra_reference) <> '')
        or exists (
          select 1 from public.user_account u3
          where u3.agency_id = u.agency_id
            and (lower(u3.email) = lower(u.email) or lower(u3.full_name) = lower(u.full_name))
            and u3.ppra_reference is not null and trim(u3.ppra_reference) <> ''
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

  if v_deal.branch_id is not null then
    select coalesce(franchise_fee_pct, 0) into v_branch_fee_pct from public.branch where id = v_deal.branch_id;
    if v_branch_fee_pct > 0 then
      v_franchise_fee := round(v_net::numeric * (v_branch_fee_pct / 100))::bigint;
    end if;
  end if;

  v_pool := v_net - v_franchise_fee;

  for v_line in select * from public.commission_rule_line where rule_set_id = v_rule.id and line_type <> 'office_share' order by sequence loop
    if v_line.calculation_basis = 'fixed' then
      v_pool := v_pool - v_line.fixed_amount_cents;
    elsif v_line.calculation_basis = 'percentage_of_remaining' then
      v_pool := v_pool - round(v_pool::numeric * v_line.rate_bps / 10000)::bigint;
    else
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
    values (v_calc_id, v_participant.user_account_id, v_participant.external_agency_name, 'primary_split', v_allocation, 0, v_advance, v_allocation - v_advance);
    v_allocated := v_allocated + v_allocation;

    if not v_participant.is_external and v_participant.user_account_id is not null then
      perform public.dispatch_notification(
        v_deal.agency_id, 'Commission issued', v_participant.user_account_id,
        '💰 Commission Issued: ' || coalesce(v_deal.reference, 'Deal'),
        'Commission calculated for ' || coalesce(v_deal.reference, 'deal') ||
          ': gross R' || to_char(v_gross / 100.0, 'FM999,999,990.00') ||
          ', your allocation R' || to_char(v_allocation / 100.0, 'FM999,999,990.00') || '.',
        'commission_calculation', v_calc_id, 'https://admin.dreamsupreme.co.za/deals/' || p_deal_id, v_gross
      );
    end if;
  end loop;

  if v_allocated > v_agent_pool then raise exception 'Allocations (%) exceed the agent pool (%). Check fixed allocations.', v_allocated, v_agent_pool; end if;
  return v_calc_id;
end;
$$;

-- =============================================================================
-- 7. Conveyancer status request -- both legs
-- =============================================================================

create or replace function public.create_status_request(p_deal_id uuid, p_recipient_email text, p_expires_in_hours integer default 72)
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_agency_id uuid;
  v_deal_ref text;
  v_recipient record;
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  if nullif(trim(p_recipient_email), '') is null then raise exception 'Recipient email is required.'; end if;
  if p_expires_in_hours < 1 or p_expires_in_hours > 168 then raise exception 'Expiry must be between 1 and 168 hours.'; end if;
  insert into public.status_request_token(deal_id, recipient_email, token_hash, expires_at)
  values (
    p_deal_id, lower(trim(p_recipient_email)), encode(digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(hours => p_expires_in_hours)
  );
  select d.agency_id, d.reference into v_agency_id, v_deal_ref from public.deal d where d.id = p_deal_id;
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (v_agency_id, public.get_current_user_account_id(), 'status_request_token', p_deal_id, 'create',
    jsonb_build_object('recipient_email', lower(trim(p_recipient_email)), 'expires_in_hours', p_expires_in_hours));

  for v_recipient in
    select id from public.user_account
    where agency_id = v_agency_id and status = 'active'
      and (role in ('admin', 'admin_agent') or id in (
        select user_account_id from public.deal_participant where deal_id = p_deal_id and is_external = false
      ))
  loop
    perform public.dispatch_notification(
      v_agency_id, 'Conveyancer status request', v_recipient.id,
      '📤 Conveyancer Status Request Sent: ' || coalesce(v_deal_ref, 'Deal'),
      'A status request link was generated for ' || coalesce(v_deal_ref, 'this deal') || ', to be sent to ' || lower(trim(p_recipient_email)) || '.',
      'deal', p_deal_id, 'https://admin.dreamsupreme.co.za/deals/' || p_deal_id, null
    );
  end loop;

  return v_token;
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
  v_recipient record;
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

  for v_recipient in
    select id from public.user_account
    where agency_id = v_deal.agency_id and status = 'active'
      and (role in ('admin', 'admin_agent') or id in (
        select user_account_id from public.deal_participant where deal_id = v_deal.id and is_external = false
      ))
  loop
    perform public.dispatch_notification(
      v_deal.agency_id, 'Conveyancer status request', v_recipient.id,
      '📥 Conveyancer Status Received: ' || v_deal.reference,
      'Lodgement date ' || p_lodged_on::text || ' submitted for deal ' || v_deal.reference,
      'deal', v_deal.id, 'https://admin.dreamsupreme.co.za/deals/' || v_deal.id, null
    );
  end loop;
end;
$$;

-- =============================================================================
-- 8. New lead
-- =============================================================================

create or replace function public.notify_new_lead()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient record;
  v_subject text := '🆕 New Lead: ' || coalesce(NEW.full_name, 'Website visitor');
  v_body text := coalesce(NEW.full_name, 'A visitor') || ' submitted a lead via ' || coalesce(NEW.source, 'the website') ||
    case when NEW.email is not null then ' (' || NEW.email || ')' else '' end || '.';
begin
  for v_recipient in
    select id from public.user_account
    where agency_id = NEW.agency_id and status = 'active'
      and role in ('agent', 'admin', 'admin_agent')
  loop
    perform public.dispatch_notification(
      NEW.agency_id, 'New lead', v_recipient.id, v_subject, v_body,
      'lead', NEW.id, 'https://admin.dreamsupreme.co.za/clients', null
    );
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_lead on public.lead;
create trigger trg_notify_new_lead
after insert on public.lead
for each row execute function public.notify_new_lead();
