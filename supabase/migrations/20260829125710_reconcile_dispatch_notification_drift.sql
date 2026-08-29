SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.dispatch_notification (
  p_agency_id           uuid,
  p_event_type          text,
  p_user_account_id     uuid,
  p_subject             text,
  p_body                text,
  p_related_entity_type text   DEFAULT NULL::text,
  p_related_entity_id   uuid   DEFAULT NULL::uuid,
  p_link                text   DEFAULT NULL::text,
  p_price_cents         bigint DEFAULT NULL::bigint,
  p_dedupe_key          text   DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_pref public.notification_preference%rowtype;
  v_role public.user_role;
  v_email text;
  v_email_enabled boolean;
  v_in_app_enabled boolean;
begin
  if p_dedupe_key is not null
     and not public.check_rate_limit('notify:' || p_dedupe_key, 1, interval '1 day') then
    return;
  end if;

  select role, email into v_role, v_email
  from public.user_account where id = p_user_account_id and status = 'active';
  if v_role is null then return; end if;

  select * into v_pref from public.notification_preference
  where agency_id = p_agency_id and event_type = p_event_type;

  v_email_enabled := coalesce(v_pref.email_enabled, true);
  v_in_app_enabled := coalesce(v_pref.in_app_enabled, true);
  if not v_email_enabled and not v_in_app_enabled then return; end if;

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
$function$;
