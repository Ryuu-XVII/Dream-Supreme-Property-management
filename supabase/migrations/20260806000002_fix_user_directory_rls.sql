-- Migration: 20260806000002_fix_user_directory_rls.sql
-- Fix user_account and user_invitation RLS select policies so team directory queries always return agency team members and pending invitations cleanly.

-- 1. Ensure user_account select policy allows reading user accounts in the current agency (or all active accounts if bootstrap)
drop policy if exists "Agency directory is readable" on public.user_account;
create policy "Agency directory is readable" on public.user_account for select
using (
  agency_id = public.get_current_agency_id()
  or public.get_current_agency_id() is null
);

-- 2. Ensure user_invitation select policy allows reading pending invitations for the agency
drop policy if exists "Managers view invitations" on public.user_invitation;
create policy "Managers view invitations" on public.user_invitation for select
using (
  agency_id = public.get_current_agency_id()
  or public.get_current_agency_id() is null
  or public.get_current_role() in ('principal', 'admin')
);
