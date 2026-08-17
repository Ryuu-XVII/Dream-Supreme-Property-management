-- SECURITY FIX: three more anonymously-callable SECURITY DEFINER functions.
--
-- 1. update_user_storage_quota(target_user_id, new_limit_bytes) used the same
--    NULL-unsafe guard as the admin_* functions: `if caller_role not in
--    ('admin','admin_agent')`. For an anonymous caller caller_role is NULL and
--    `NULL not in (…)` is NULL, so the raise never fired. Verified live — an
--    anonymous caller changed the master admin's storage_limit_bytes from 1 GB
--    to 777 GB. Fixed with a NULL-safe guard and revoked from anon/public.
--
-- 2. process_monthly_section_86_4_interest_allocation() and
--    generate_daily_notification_digests() have NO authorization check at all.
--    They are intended to be invoked only by pg_cron (jobs
--    'monthly-trust-interest-allocation' and 'generate_daily_notification_digests'),
--    but were also granted to anon/public, so anyone could trigger a trust-interest
--    allocation run or a notification-digest sweep. pg_cron executes them as the
--    job owner, not as anon, so revoking anon/public EXECUTE does not affect the
--    scheduled runs.

create or replace function public.update_user_storage_quota(target_user_id uuid, new_limit_bytes bigint)
returns void
language plpgsql
security definer
as $function$
declare
  caller_role public.user_role;
begin
  select role into caller_role
  from public.user_account
  where auth_user_id = auth.uid();

  if coalesce(caller_role::text, '') not in ('admin', 'admin_agent') then
    raise exception 'Unauthorized: Only administrative staff can update storage quotas.';
  end if;

  if new_limit_bytes < 0 then
    raise exception 'Storage limit cannot be negative.';
  end if;

  update public.user_account
  set storage_limit_bytes = new_limit_bytes,
      updated_at = now()
  where id = target_user_id;
end;
$function$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.update_user_storage_quota(uuid, bigint)',
    'public.process_monthly_section_86_4_interest_allocation(uuid, date)',
    'public.generate_daily_notification_digests()'
  ] loop
    execute format('revoke all on function %s from anon, public;', fn);
  end loop;

  -- Only update_user_storage_quota is a user-facing admin action; grant it to
  -- authenticated. The other two are cron-only and need no client grant.
  execute 'grant execute on function public.update_user_storage_quota(uuid, bigint) to authenticated;';
end $$;
