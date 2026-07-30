-- =============================================================================
-- USER ACCOUNT SELF-UPDATE RLS & FIELD PROTECTION
-- Migration: 20260730000000_user_account_update_rls.sql
-- =============================================================================

-- 1. Create a trigger function to protect sensitive fields from being escalated
create or replace function public.protect_user_account_sensitive_fields()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- If the user is a principal or admin, they are allowed to manage sensitive fields.
  if public.get_current_role() in ('principal', 'admin') then
    return new;
  end if;

  -- For standard users (agents, candidates), they can only update their own row (enforced by RLS),
  -- but we must explicitly block them from escalating their privileges or changing agencies.
  if new.role is distinct from old.role or
     new.status is distinct from old.status or
     new.agency_id is distinct from old.agency_id or
     new.commission_pct is distinct from old.commission_pct or
     new.auth_user_id is distinct from old.auth_user_id then
       raise exception 'You do not have permission to modify restricted fields (role, status, agency_id, commission_pct).';
  end if;
  
  return new;
end;
$$;

drop trigger if exists ensure_user_account_protection on public.user_account;
create trigger ensure_user_account_protection
before update on public.user_account
for each row execute function public.protect_user_account_sensitive_fields();

-- 2. Add the RLS policy to allow users to update their own profile
drop policy if exists "Users can update their own profile" on public.user_account;
create policy "Users can update their own profile" on public.user_account for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());
