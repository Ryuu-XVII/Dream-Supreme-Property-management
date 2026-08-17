-- SECURITY FIX: NULL-role authorization bypass in admin SECURITY DEFINER functions.
--
-- The admin_* functions guarded themselves with either
--     if not (public.get_current_role() in ('admin','admin_agent') and …) then raise;
-- or
--     if public.get_current_role() not in ('admin','admin_agent') then raise;
--
-- For an unauthenticated caller (the public anon key, which ships in the browser
-- bundle) public.get_current_role() returns NULL. In Postgres three-valued logic
-- `NULL in (…)` and `NULL not in (…)` evaluate to NULL, and `IF NULL THEN …`
-- does NOT execute — so the `raise` never fired and the function ran its
-- privileged body as the definer. Verified live: an anonymous caller reached
-- admin_empty_recycle_bin and it executed (returned row counts) instead of
-- rejecting. These functions permanently purge the recycle bin, archive deals,
-- suspend agents, retire users, and reset commissions, so this was an
-- anonymous, destructive-write bypass.
--
-- Fix, applied in two independent layers:
--   1. Guard logic is rewritten to be NULL-safe: `coalesce(role::text,'')
--      not in (…)` is TRUE for a NULL role, and agency scoping uses the
--      NULL-safe `is distinct from`. A NULL role now always raises.
--   2. EXECUTE is revoked from anon and public and granted only to
--      authenticated, so an unauthenticated key cannot reach these functions
--      at all even if a future guard regressed.

create or replace function public.admin_archive_old_deals(p_agency_id uuid)
returns integer
language plpgsql
security definer
as $function$
declare
  v_archived_count integer;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent')
     or public.get_current_agency_id() is distinct from p_agency_id then
    raise exception 'Unauthorized: Only administrators can archive deals for this agency.';
  end if;

  update public.deal
  set status = 'archived', updated_at = now()
  where agency_id = p_agency_id
    and status in ('registered', 'cancelled')
    and updated_at < now() - interval '3 years';

  get diagnostics v_archived_count = row_count;

  return v_archived_count;
end;
$function$;

create or replace function public.admin_deactivate_idle_agents(p_agency_id uuid)
returns integer
language plpgsql
security definer
as $function$
declare
  v_deactivated_count integer;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent')
     or public.get_current_agency_id() is distinct from p_agency_id then
    raise exception 'Unauthorized: Only administrators can deactivate agents for this agency.';
  end if;

  update public.user_account
  set status = 'suspended', updated_at = now()
  where agency_id = p_agency_id
    and role not in ('admin', 'admin_agent')
    and status = 'active'
    and (
      (last_login_at is not null and last_login_at < now() - interval '90 days')
      or
      (last_login_at is null and updated_at < now() - interval '90 days')
    );

  get diagnostics v_deactivated_count = row_count;

  return v_deactivated_count;
end;
$function$;

create or replace function public.admin_empty_recycle_bin(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_deals_deleted integer;
  v_properties_deleted integer;
  v_parties_deleted integer;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent')
     or public.get_current_agency_id() is distinct from p_agency_id then
    raise exception 'Unauthorized: Only administrators can empty the recycle bin for this agency.';
  end if;

  delete from public.deal
  where agency_id = p_agency_id and archived_at is not null;
  get diagnostics v_deals_deleted = row_count;

  delete from public.property
  where agency_id = p_agency_id and archived_at is not null;
  get diagnostics v_properties_deleted = row_count;

  delete from public.party
  where agency_id = p_agency_id and archived_at is not null;
  get diagnostics v_parties_deleted = row_count;

  return jsonb_build_object(
    'deals', v_deals_deleted,
    'properties', v_properties_deleted,
    'parties', v_parties_deleted
  );
end;
$function$;

create or replace function public.admin_bulk_reset_commission(p_user_ids uuid[])
returns void
language plpgsql
security definer
as $function$
declare
  v_agency_id uuid;
  v_user_id uuid;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
    raise exception 'Unauthorized: Only administrators can reset commissions.';
  end if;

  v_agency_id := public.get_current_agency_id();

  update public.user_account
  set commission_pct = null,
      updated_at = now()
  where id = any(p_user_ids)
    and agency_id = v_agency_id;

  foreach v_user_id in array p_user_ids loop
    insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
    values (
      v_agency_id,
      public.get_current_user_account_id(),
      'user_account',
      v_user_id,
      'commission_reset',
      jsonb_build_object('commission_pct', null)
    );
  end loop;
end;
$function$;

create or replace function public.admin_bulk_retire_users(p_user_ids uuid[])
returns void
language plpgsql
security definer
as $function$
declare
  v_agency_id uuid;
  v_user_id uuid;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
    raise exception 'Unauthorized: Only administrators can retire users.';
  end if;

  v_agency_id := public.get_current_agency_id();

  update public.user_account
  set status = 'archived',
      updated_at = now()
  where id = any(p_user_ids)
    and agency_id = v_agency_id;

  foreach v_user_id in array p_user_ids loop
    insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
    values (
      v_agency_id,
      public.get_current_user_account_id(),
      'user_account',
      v_user_id,
      'archived',
      jsonb_build_object('status', 'archived')
    );
  end loop;
end;
$function$;

-- Layer 2: only authenticated sessions may call these at all.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_archive_old_deals(uuid)',
    'public.admin_deactivate_idle_agents(uuid)',
    'public.admin_empty_recycle_bin(uuid)',
    'public.admin_bulk_reset_commission(uuid[])',
    'public.admin_bulk_retire_users(uuid[])'
  ] loop
    execute format('revoke all on function %s from anon, public;', fn);
    execute format('grant execute on function %s to authenticated;', fn);
  end loop;
end $$;
