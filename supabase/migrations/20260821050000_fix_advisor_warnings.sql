-- Cleans up RLS warnings surfaced by the Supabase advisor.

-- 1. Real access-control bug: bond_application still carried its original,
-- broad "same agency" policies (agency_id match via a deal/user_account
-- join) alongside the newer can_access_deal()-scoped "Accessible deal child
-- records" policies added later to restrict agents to deals they actually
-- created or participate in (matching every sibling deal-child table:
-- checklist_item, deal_participant, deal_party, deal_stage_history, offer,
-- suspensive_condition, none of which have this leftover). Because RLS
-- permissive policies OR together, the old broad policy silently re-opened
-- agency-wide visibility into every deal's bond applications for every
-- agent, defeating the narrower can_access_deal() restriction entirely.
-- Dropping it (no DELETE replacement needed — none of its sibling
-- deal-child tables allow DELETE either, consistent with the platform's
-- no-hard-delete stance) both closes that gap and removes 4 of the
-- advisor's "re-evaluates auth.uid() per row" warnings for free, since the
-- surviving can_access_deal()-based policies don't reference auth.uid()
-- directly in their policy expression.
drop policy if exists "Users can view bond applications for their agency" on public.bond_application;
drop policy if exists "Users can insert bond applications for their agency" on public.bond_application;
drop policy if exists "Users can update bond applications for their agency" on public.bond_application;
drop policy if exists "Users can delete bond applications for their agency" on public.bond_application;

-- 2. Dead duplicate policies: each of these was meant to be replaced by a
-- newer, strictly broader policy on the same table/command, but the
-- migration that added the replacement never dropped the original (visible
-- from `create policy "Users can view their notifications" ...` in
-- 20260730000004_phase3d_notifications.sql, which names a *different*
-- policy than the one it was replacing). The old policy's condition is
-- already fully covered by an `OR` branch in the new one, so it's dead
-- weight — same access, one extra per-row evaluation for nothing.
drop policy if exists "Users can view their own notifications" on public.notification;
drop policy if exists "Users can update their own profile" on public.user_account;

-- 3. Remaining "auth.uid()/auth.role() re-evaluated per row" warnings:
-- wrap each in `(select ...)` so Postgres computes it once per query
-- (an InitPlan) instead of once per row. No behavior change, only how many
-- times an already-STABLE expression gets evaluated.
alter policy "Transfer duty brackets viewable by authenticated users" on public.config_transfer_duty
  using ((select auth.role()) = 'authenticated'::text);

alter policy "Users can view their notifications" on public.notification
  using (
    exists (
      select 1 from public.user_account u
      where u.auth_user_id = (select auth.uid())
        and u.agency_id = notification.agency_id
        and (notification.user_id = u.id or notification.user_account_id = u.id or notification.user_id is null)
    )
  );

alter policy "Users can mark notifications as read" on public.notification
  using (
    exists (
      select 1 from public.user_account u
      where u.auth_user_id = (select auth.uid())
        and u.agency_id = notification.agency_id
        and (notification.user_id = u.id or notification.user_account_id = u.id or notification.user_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.user_account u
      where u.auth_user_id = (select auth.uid())
        and u.agency_id = notification.agency_id
        and (notification.user_id = u.id or notification.user_account_id = u.id or notification.user_id is null)
    )
  );

alter policy "Users manage their own notification preferences" on public.user_notification_preference
  using (
    user_id = public.get_current_user_account_id()
    or exists (
      select 1 from public.user_account u
      where u.auth_user_id = (select auth.uid()) and u.id = user_notification_preference.user_id
    )
  )
  with check (
    user_id = public.get_current_user_account_id()
    or exists (
      select 1 from public.user_account u
      where u.auth_user_id = (select auth.uid()) and u.id = user_notification_preference.user_id
    )
  );

alter policy "Users can view own account or their agency's directory" on public.user_account
  using (
    auth_user_id = (select auth.uid())
    or agency_id = public.get_current_agency_id()
  );

alter policy "Users can update own account or managers update agency users" on public.user_account
  using (
    auth_user_id = (select auth.uid())
    or (agency_id = public.get_current_agency_id() and public.is_manager())
  )
  with check (
    auth_user_id = (select auth.uid())
    or agency_id = public.get_current_agency_id()
  );
