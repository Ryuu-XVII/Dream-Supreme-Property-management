-- notify_agency_admins() previously only ever notified admins/admin_agents
-- about deal events (new deal, registered, cancelled, stage change, progress
-- note) — the agents actually working the deal got nothing. Admins should
-- keep seeing everything happening in the agency; agents should now also be
-- notified, but only about deals they're a participant on (their own stuff).
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
  v_recipient record;
  v_event_type text := 'deal_update';
begin
  if TG_TABLE_NAME = 'deal' then
    v_deal_id := NEW.id;
    v_agency_id := NEW.agency_id;
    v_deal_ref := NEW.reference;
    v_link := '/deals/' || v_deal_id;

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
    v_link := '/deals/' || v_deal_id;

    select reference into v_deal_ref from public.deal where id = v_deal_id;

    if NEW.action = 'progress_note_added' then
      v_subject := '📝 Progress Note Added: ' || coalesce(v_deal_ref, 'Deal');
      v_body := 'An operational update note was logged: "' ||
                coalesce(NEW.after_json->>'note', 'Note added') || '"';
    else
      return NEW;
    end if;
  end if;

  -- Recipients: every admin/admin_agent in the agency (they see all deals),
  -- plus the internal agents actually on this deal (deal_participant), who
  -- should only hear about their own deals.
  for v_recipient in
    select id, email from public.user_account
    where agency_id = v_agency_id and role in ('admin', 'admin_agent')
    union
    select u.id, u.email
    from public.deal_participant dp
    join public.user_account u on u.id = dp.user_account_id
    where dp.deal_id = v_deal_id and dp.is_external = false
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
      v_body,
      v_link,
      now()
    );

    insert into public.email_queue (
      agency_id,
      recipient_email,
      subject,
      body_html,
      status,
      created_at
    ) values (
      v_agency_id,
      v_recipient.email,
      v_subject,
      '<div style="font-family: sans-serif; padding: 16px;">' ||
      '<h2>' || v_subject || '</h2>' ||
      '<p>' || v_body || '</p>' ||
      '<p><a href="' || v_link || '" style="color: #2563eb; font-weight: bold;">View Deal Details</a></p>' ||
      '</div>',
      'pending',
      now()
    );
  end loop;

  return NEW;
end;
$$;

-- create_deal() inserts the deal row, then inserts its deal_participant row
-- afterwards in the same transaction. A plain AFTER trigger fires immediately
-- on the deal insert, before that participant row exists, so the new agent
-- would be silently skipped for the "New Deal Opened" notification. Deferring
-- the trigger to commit time lets it run only once the participant row is
-- there too.
drop trigger if exists trg_notify_deal_events on public.deal;
create constraint trigger trg_notify_deal_events
  after insert or update of stage, status on public.deal
  deferrable initially deferred
  for each row execute function public.notify_agency_admins();
