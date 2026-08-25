-- The dispatch call to send-queued-emails was only sending an Authorization
-- header. Supabase's edge gateway also requires an apikey header on every
-- request or it 503s before the function ever runs, which is why every
-- pg_cron dispatch tick was silently failing (net.http_post returning 503,
-- email_queue rows never advancing past "pending").
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
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$;
