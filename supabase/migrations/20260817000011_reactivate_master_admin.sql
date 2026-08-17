-- SECURITY/CORRECTNESS FIX: the master admin account was left `archived`.
--
-- 20260807000000_seed_master_admin.sql provisions admin@dreamsupreme.co.za with
-- status 'active', but the immediately-following 20260807000001_cleanup_manual_admin.sql
-- archived it (it was intended to clean up a stray manual row and caught the real
-- one). The consequence was subtle but serious: public.get_current_user_account_id()
-- and get_current_role() both filter on status = 'active', so for the master admin
-- session they returned NULL — the database did not recognize the logged-in master
-- admin as an admin at all.
--
-- Because of that, the app's admin behaviour only ever "worked" through insecure
-- side doors: the hardcoded client-side password bypass in login.tsx, and the
-- anonymous create_user_invitation path (fixed in 20260817000010). It also made
-- the normal login flow bounce back to /login, since isActiveAccount() failed.
--
-- Restoring the account to 'active' is what the seed intended and is required for
-- server-side authorization to recognize the master admin properly.

do $$
begin
  alter table public.user_account disable trigger ensure_user_account_protection;
  update public.user_account
    set status = 'active'
    where email = 'admin@dreamsupreme.co.za' and status <> 'active';
  alter table public.user_account enable trigger ensure_user_account_protection;
end $$;
