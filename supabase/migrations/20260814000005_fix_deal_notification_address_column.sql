-- Migration: Fix notify_agency_admins() referencing a non-existent column
-- Description: notify_agency_admins() (20260808000000_admin_deal_notifications.sql)
-- selected `address` from public.property, but that column has always been
-- named `address_line`. The trigger fires AFTER INSERT OR UPDATE OF stage,
-- status ON public.deal, so this broke every deal creation with
-- 'column "address" does not exist' as soon as a deal actually reached the
-- insert (previously masked by the FICA/mandate validation errors that
-- blocked deal creation before it got this far).

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
  v_admin_record record;
  v_event_type text := 'deal_update';
begin
  if TG_TABLE_NAME = 'deal' then
    v_deal_id := NEW.id;
    v_agency_id := NEW.agency_id;
    v_deal_ref := NEW.reference;
    v_link := '/deals/' || v_deal_id;

    -- Fetch property address
    select address_line into v_property_address from public.property where id = NEW.property_id;

    -- Scenario 1: Deal Newly Registered (Closed Sale)
    if NEW.stage = 'registered' and (OLD is null or OLD.stage <> 'registered') then
      v_subject := '🎉 Deal Registered & Closed: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal for property at ' || coalesce(v_property_address, 'Property') ||
                ' has been registered and closed. Final sale price: R' ||
                to_char(coalesce(NEW.sale_price_cents, 0) / 100.0, 'FM999,999,990.00');

    -- Scenario 2: Deal Cancelled
    elsif NEW.status = 'cancelled' and (OLD is null or OLD.status <> 'cancelled') then
      v_subject := '🚨 Deal Cancelled: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal at ' || coalesce(v_property_address, 'Property') ||
                ' was cancelled. Reason: ' || coalesce(NEW.cancellation_reason::text, 'Not specified') ||
                case when NEW.cancellation_notes is not null then '. Notes: ' || NEW.cancellation_notes else '' end;

    -- Scenario 3: Stage Transition
    elsif OLD is not null and OLD.stage <> NEW.stage then
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

  -- Broadcast notification to all admins and principals in the agency
  for v_admin_record in
    select id, email
    from public.user_account
    where agency_id = v_agency_id
      and role in ('admin', 'principal')
  loop
    -- In-app notification
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
      v_admin_record.id,
      v_admin_record.id,
      v_event_type,
      v_subject,
      v_body,
      v_link,
      now()
    );

    -- Email Queue Entry
    insert into public.email_queue (
      agency_id,
      recipient_email,
      subject,
      body_html,
      status,
      created_at
    ) values (
      v_agency_id,
      v_admin_record.email,
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

-- Migration: Fix trigger_deal_stage_whatsapp_notification()
-- Description: This trigger (20260803000012_whatsapp_gateway.sql) never ran
-- correctly: it called a non-existent email_phone_number() function first
-- (would raise immediately), queried dp.role = 'buyer' when the deal_party
-- role enum only has 'purchaser', selected a p.phone column that doesn't
-- exist (party's number column is `mobile`), and referenced new.address on
-- deal, which has no address column at all (property does, via property_id).
create or replace function public.trigger_deal_stage_whatsapp_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_phone text;
  v_seller_phone text;
  v_property_address text;
begin
  if new.stage is distinct from old.stage and new.stage in ('bond_approved', 'registered') then

    select p.mobile into v_buyer_phone
    from public.deal_party dp
    join public.party p on dp.party_id = p.id
    where dp.deal_id = new.id and dp.role = 'purchaser'
    limit 1;

    select p.mobile into v_seller_phone
    from public.deal_party dp
    join public.party p on dp.party_id = p.id
    where dp.deal_id = new.id and dp.role = 'seller'
    limit 1;

    select address_line into v_property_address from public.property where id = new.property_id;

    if v_buyer_phone is not null then
      insert into public.whatsapp_queue (agency_id, recipient_phone, template_name, template_data)
      values (
        new.agency_id,
        v_buyer_phone,
        'deal_stage_' || new.stage::text,
        jsonb_build_object('deal_id', new.id, 'property_address', v_property_address, 'stage', new.stage)
      );
    end if;

    if v_seller_phone is not null then
      insert into public.whatsapp_queue (agency_id, recipient_phone, template_name, template_data)
      values (
        new.agency_id,
        v_seller_phone,
        'deal_stage_' || new.stage::text,
        jsonb_build_object('deal_id', new.id, 'property_address', v_property_address, 'stage', new.stage)
      );
    end if;

  end if;
  return new;
end;
$$;
