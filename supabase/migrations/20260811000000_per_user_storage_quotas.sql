-- Migration: Per-User Storage Quotas and Usage Tracking
-- Adds storage_limit_bytes and storage_used_bytes to public.user_account
-- Default storage limit: 1 GB (1073741824 bytes)

alter table public.user_account
  add column if not exists storage_limit_bytes bigint not null default 1073741824,
  add column if not exists storage_used_bytes bigint not null default 0;

-- RPC Function: Update user storage quota (Admin/Principal only)
create or replace function public.update_user_storage_quota(
  target_user_id uuid,
  new_limit_bytes bigint
)
returns void
language plpgsql
security definer
as $$
declare
  caller_role public.user_role;
begin
  select role into caller_role
  from public.user_account
  where auth_user_id = auth.uid();

  if caller_role not in ('admin', 'principal') then
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
$$;

-- RPC Function: Adjust user storage usage
create or replace function public.adjust_user_storage_usage(
  target_user_id uuid,
  bytes_delta bigint
)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_account
  set storage_used_bytes = greatest(0, storage_used_bytes + bytes_delta),
      updated_at = now()
  where id = target_user_id;
end;
$$;

-- Grant execution permissions
grant execute on function public.update_user_storage_quota(uuid, bigint) to authenticated;
grant execute on function public.adjust_user_storage_usage(uuid, bigint) to authenticated;
