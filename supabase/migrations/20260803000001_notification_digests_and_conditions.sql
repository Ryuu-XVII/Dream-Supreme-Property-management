-- Phase 4B: Notification Digests & Smart Alerts

-- 1. Add frequency and conditions to user preferences
alter table public.user_notification_preference 
add column if not exists frequency text not null default 'realtime' check (frequency in ('realtime', 'digest')),
add column if not exists condition_config jsonb;

alter table public.notification_preference
add column if not exists condition_config jsonb;

-- 2. Add delivery_status to notifications
alter table public.notification
add column if not exists delivery_status text not null default 'sent' check (delivery_status in ('sent', 'pending_digest', 'digest_queued'));

-- 3. Create the Digest Generator Function
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
  -- Loop through each user who has pending digest notifications
  for r in 
    select user_id, a.id as agency_id, u.email, u.full_name
    from public.notification n
    join public.user_account u on n.user_id = u.id
    join public.agency a on u.agency_id = a.id
    where n.delivery_status = 'pending_digest'
    group by n.user_id, a.id, u.email, u.full_name
  loop
    -- Build the email body
    v_email_body := '<h2>Your Daily Notification Digest</h2><ul>';
    v_count := 0;

    for v_count, v_email_body in
      select count(*), string_agg('<li><strong>' || subject || ':</strong> ' || body || '</li>', '')
      from public.notification
      where user_id = r.user_id and delivery_status = 'pending_digest'
    loop
      -- Aggregation happens implicitly here
    end loop;

    if v_email_body is not null then
      v_email_body := v_email_body || '</ul><p>You have ' || v_count || ' new updates today.</p>';

      -- Insert into email queue
      insert into public.email_queue (agency_id, recipient_email, subject, body_html, status)
      values (r.agency_id, r.email, 'Daily Digest - Dream Supreme Properties', v_email_body, 'pending');

      -- Mark notifications as queued
      update public.notification
      set delivery_status = 'digest_queued'
      where user_id = r.user_id and delivery_status = 'pending_digest';
    end if;
  end loop;
end;
$$;

-- Schedule the digest to run daily at 8:00 AM UTC (using pg_cron)
-- Only run if the extension is enabled, which we assume it is since other jobs use it
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule('generate_daily_notification_digests', '0 8 * * *', 'select public.generate_daily_notification_digests()');
  end if;
end
$$;
