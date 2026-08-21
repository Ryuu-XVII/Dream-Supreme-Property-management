-- Two more dead-duplicate policies found while triaging
-- multiple_permissive_policies, same shape as the notification/user_account
-- ones dropped in 20260821050000: a newer, equal-or-broader policy was added
-- without dropping the one it replaced.

-- "Transfer duty brackets viewable by authenticated users" (any authenticated
-- Supabase user, not even required to have a user_account row) is strictly
-- broader than, and therefore fully superseded by, "Agency users read
-- transfer duty configuration" (get_current_agency_id() is not null, i.e.
-- any active agency member) — every user permitted by the old policy that
-- also has a real account is permitted by the new one; the old policy's only
-- extra reach (auth users with no user_account row) was never a meaningful
-- distinction for this table (global SARS tax-bracket reference data, no
-- agency_id column to scope by regardless).
drop policy if exists "Transfer duty brackets viewable by authenticated users" on public.config_transfer_duty;

-- "Users mark own notifications read" (direct user_account_id match) is
-- narrower than, and fully covered by, "Users can mark notifications as
-- read" (matches on user_id OR user_account_id OR a null-broadcast case,
-- scoped to the same agency) — dropping it changes nothing anyone could
-- actually do.
drop policy if exists "Users mark own notifications read" on public.notification;
