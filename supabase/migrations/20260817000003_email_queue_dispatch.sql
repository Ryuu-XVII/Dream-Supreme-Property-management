-- Wires a consumer onto public.email_queue, which previously had producers
-- (generate_daily_notification_digests, the invitation flow) but nothing
-- that ever sent the queued rows. Dispatch happens via a Postgres-to-HTTP
-- call (pg_net) into the supabase/functions/send-queued-emails Edge
-- Function, which does the actual SMTP send.

create extension if not exists pg_net with schema extensions;

-- The service-role key used to authorize the function call is stored in
-- Supabase Vault (never in this migration file). Set it once via:
--   select vault.create_secret('<service-role-key>', 'email_dispatch_service_key');
-- and the function URL via:
--   select vault.create_secret('<project-ref>.functions.supabase.co/send-queued-emails', 'email_dispatch_function_url');
create or replace function public.trigger_email_queue_dispatch()
returns void
language plpgsql security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_dispatch_function_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'email_dispatch_service_key';
  if v_url is null or v_key is null then
    raise warning 'email dispatch secrets not configured in Vault; skipping';
    return;
  end if;
  perform net.http_post(
    url := 'https://' || v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.trigger_email_queue_dispatch() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('dispatch_email_queue', '*/5 * * * *', 'select public.trigger_email_queue_dispatch()');
  end if;
end $$;

-- Tighten the digest builder now that its output is actually consumed: the
-- prior `for v_count, v_email_body in select ... loop ... end loop` relied on
-- the query returning exactly one aggregate row and just assigned rather
-- than appending. A plain `select ... into` is the same result, less
-- confusing, and easier to trust now that a real send depends on it.
create or replace function public.generate_daily_notification_digests()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  v_email_body text;
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
    select count(*), string_agg('<li><strong>' || subject || ':</strong> ' || body || '</li>', '')
    into v_count, v_email_body
    from public.notification
    where user_id = r.user_id and delivery_status = 'pending_digest';

    if v_email_body is not null then
      v_email_body := '<h2>Your Daily Notification Digest</h2><ul>' || v_email_body
        || '</ul><p>You have ' || v_count || ' new updates today.</p>';

      insert into public.email_queue (agency_id, recipient_email, subject, body_html, status)
      values (r.agency_id, r.email, 'Daily Digest - Dream Supreme Properties', v_email_body, 'pending');

      update public.notification
      set delivery_status = 'digest_queued'
      where user_id = r.user_id and delivery_status = 'pending_digest';
    end if;
  end loop;
end;
$$;
