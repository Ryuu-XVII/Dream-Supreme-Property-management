-- Admin deal notifications didn't say which agent the deal belonged to, so an
-- admin overseeing many agents couldn't tell at a glance who to follow up
-- with. Append "Agent: <name>" to the body for admin recipients only — an
-- agent reading a notification about their own deal doesn't need to be told
-- it's theirs.
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
      body_html,
      status,
      created_at
    ) values (
      v_agency_id,
      v_recipient.email,
      v_subject,
      '<div style="font-family: sans-serif; padding: 16px;">' ||
      '<h2>' || v_subject || '</h2>' ||
      '<p>' || (case when v_recipient.is_admin and v_agent_names is not null
        then v_body || ' — Agent: ' || v_agent_names
        else v_body
      end) || '</p>' ||
      '<p><a href="' || v_link || '" style="color: #2563eb; font-weight: bold;">View Deal Details</a></p>' ||
      '</div>',
      'pending',
      now()
    );
  end loop;

  return NEW;
end;
$$;
