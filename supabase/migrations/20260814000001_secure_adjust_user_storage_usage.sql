-- Migration: Restrict adjust_user_storage_usage to self or admin callers.
-- The function was security definer with no ownership check, so any
-- authenticated user could pass an arbitrary target_user_id and inflate or
-- deflate another user's storage_used_bytes. Restrict it to the caller
-- adjusting their own usage, or an admin/admin_agent adjusting anyone's.

create or replace function public.adjust_user_storage_usage(
  target_user_id uuid,
  bytes_delta bigint
)
returns void
language plpgsql
security definer
as $$
declare
  caller_id uuid;
  caller_role text;
begin
  select id, role::text into caller_id, caller_role
  from public.user_account
  where auth_user_id = auth.uid();

  if caller_id is null then
    raise exception 'Unauthorized: Active agent profile required to adjust storage usage.';
  end if;

  if caller_id != target_user_id and caller_role not ilike '%admin%' then
    raise exception 'Unauthorized: You can only adjust your own storage usage.';
  end if;

  update public.user_account
  set storage_used_bytes = greatest(0, storage_used_bytes + bytes_delta),
      updated_at = now()
  where id = target_user_id;
end;
$$;
