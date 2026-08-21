-- Closes the gap where the admin-customizable email_template table was
-- write-only: deal_notification and daily_notification_digest emails were
-- actually built from hardcoded HTML concatenated directly in these two
-- Postgres functions, completely ignoring whatever an admin designed and
-- saved in the template builder. Postgres can't render the EmailBuilder.js
-- document schema (that's a React server-render step), so instead of
-- building final HTML here, these functions now queue structured
-- `email_type` + `merge_values`, and the send-queued-emails Edge Function
-- (Deno, can run React SSR) looks up the agency's saved template for that
-- type, merges the values in, and renders the HTML immediately before SMTP
-- send. Falls back to a plain `subject`/`body_html` when a row isn't tied to
-- a known template type, so anything that still inserts pre-rendered HTML
-- directly keeps working unchanged.
alter table public.email_queue
  add column if not exists email_type text,
  add column if not exists merge_values jsonb;

alter table public.email_queue
  alter column body_html drop not null;

alter table public.email_queue
  add constraint email_queue_body_or_template check (
    body_html is not null or email_type is not null
  );

-- Same treatment fixes a second bug for free: the raw string concatenation
-- this replaces interpolated notification subject/body (which can contain
-- agent-typed free text, e.g. deal cancellation_notes) straight into HTML
-- with no escaping. The template renderer merges values through React,
-- which escapes text content by default, so that HTML-injection path closes
-- along with the "ignores the saved template" one.
create or replace function public.notify_agency_admins()
returns trigger
language plpgsql
security definer
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
  v_recipient record;
  v_event_type text := 'deal_update';
begin
  if TG_TABLE_NAME = 'deal' then
    v_deal_id := NEW.id;
    v_agency_id := NEW.agency_id;
    v_deal_ref := NEW.reference;
    v_link := 'https://admin.dreamsupreme.co.za/deals/' || v_deal_id;

    select address_line into v_property_address from public.property where id = NEW.property_id;

    if OLD is null then
      v_subject := '🆕 New Deal Opened: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'A new deal was opened for property at ' || coalesce(v_property_address, 'Property') ||
                ', sale price R' || to_char(coalesce(NEW.sale_price_cents, 0) / 100.0, 'FM999,999,990.00') || '.';

    elsif NEW.stage = 'registered' and OLD.stage <> 'registered' then
      v_subject := '🎉 Deal Registered & Closed: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal for property at ' || coalesce(v_property_address, 'Property') ||
                ' has been registered and closed. Final sale price: R' ||
                to_char(coalesce(NEW.sale_price_cents, 0) / 100.0, 'FM999,999,990.00');

    elsif NEW.status = 'cancelled' and OLD.status <> 'cancelled' then
      v_subject := '🚨 Deal Cancelled: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal at ' || coalesce(v_property_address, 'Property') ||
                ' was cancelled. Reason: ' || coalesce(NEW.cancellation_reason::text, 'Not specified') ||
                case when NEW.cancellation_notes is not null then '. Notes: ' || NEW.cancellation_notes else '' end;

    elsif OLD.stage <> NEW.stage then
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

  -- Recipients: every admin/admin_agent in the agency (they see all deals),
  -- plus the internal agents actually on this deal (deal_participant), who
  -- should only hear about their own deals. An admin who also happens to be
  -- a participant is deduped to a single row, kept as "admin" so they get
  -- the agent-attributed body rather than a duplicate plain one.
  for v_recipient in
    select id, email, bool_or(is_admin) as is_admin from (
      select id, email, true as is_admin from public.user_account
      where agency_id = v_agency_id and role in ('admin', 'admin_agent')
      union all
      select u.id, u.email, false as is_admin
      from public.deal_participant dp
      join public.user_account u on u.id = dp.user_account_id
      where dp.deal_id = v_deal_id and dp.is_external = false
    ) recipients
    group by id, email
  loop
    insert into public.notification (
      agency_id,
      user_id,
      user_account_id,
      type,
      subject,
      body,
      link,
      created_at
    ) values (
      v_agency_id,
      v_recipient.id,
      v_recipient.id,
      v_event_type,
      v_subject,
      case when v_recipient.is_admin and v_agent_names is not null
        then v_body || ' — Agent: ' || v_agent_names
        else v_body
      end,
      v_link,
      now()
    );

    insert into public.email_queue (
      agency_id,
      recipient_email,
      subject,
      email_type,
      merge_values,
      status,
      created_at
    ) values (
      v_agency_id,
      v_recipient.email,
      v_subject,
      'deal_notification',
      jsonb_build_object(
        'eventSubject', v_subject,
        'eventBody', case when v_recipient.is_admin and v_agent_names is not null
          then v_body || ' — Agent: ' || v_agent_names
          else v_body
        end,
        'dealLink', v_link
      ),
      'pending',
      now()
    );
  end loop;

  return NEW;
end;
$$;

-- Tighten the digest builder now that a real, admin-designed template
-- renders it: no more assembling an ad-hoc HTML `<ul>` of every notification
-- in Postgres string concatenation (unescaped) — the digest template is a
-- summary ("you have N updates, view them") rather than an inline list, so
-- send-queued-emails only needs the count and a link.
create or replace function public.generate_daily_notification_digests()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_count int;
begin
  for r in
    select user_id, a.id as agency_id, u.email, u.full_name
    from public.notification n
    join public.user_account u on n.user_id = u.id
    join public.agency a on u.agency_id = a.id
    where n.delivery_status = 'pending_digest'
    group by n.user_id, a.id, u.email, u.full_name
  loop
    select count(*) into v_count
    from public.notification
    where user_id = r.user_id and delivery_status = 'pending_digest';

    if v_count > 0 then
      insert into public.email_queue (agency_id, recipient_email, subject, email_type, merge_values, status)
      values (
        r.agency_id,
        r.email,
        'Daily Digest - Dream Supreme Properties',
        'daily_notification_digest',
        jsonb_build_object(
          'recipientName', coalesce(r.full_name, 'there'),
          'digestCount', v_count::text,
          'notificationsUrl', 'https://app.dreamsupreme.co.za/notifications'
        ),
        'pending'
      );

      update public.notification
      set delivery_status = 'digest_queued'
      where user_id = r.user_id and delivery_status = 'pending_digest';
    end if;
  end loop;
end;
$$;
