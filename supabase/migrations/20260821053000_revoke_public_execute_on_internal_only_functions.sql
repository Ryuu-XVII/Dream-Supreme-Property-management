-- CRITICAL: process_monthly_section_86_4_interest_allocation is a
-- SECURITY DEFINER function meant to run only from the monthly pg_cron job
-- (see documentation/technical/COMPLIANCE_AUDIT_2026-08-19.md §3), but it
-- had EXECUTE granted to `authenticated` and, unlike every properly-designed
-- RPC in this codebase, contains no internal role/authorization check at
-- all — no `if get_current_role() not in (...) then raise exception`. Found
-- while triaging the Supabase advisor's SECURITY DEFINER exposure warnings.
-- Any logged-in user, including a plain agent, could call it directly via
-- `/rest/v1/rpc/process_monthly_section_86_4_interest_allocation` with no
-- arguments (both parameters default: all agencies, today's date) and it
-- would post real trust-account interest-credit and PPRA-levy entries,
-- write audit_log rows, and notify a principal — a real, unauthorized
-- financial write, bypassing the monthly schedule and any approval step
-- entirely. Revoking EXECUTE from anon/authenticated closes this; the cron
-- job runs as a role that isn't covered by this revoke (the same pattern
-- already used for trigger_email_queue_dispatch()).
revoke all on function public.process_monthly_section_86_4_interest_allocation(uuid, date) from public, anon, authenticated;

-- Same hygiene for generate_daily_notification_digests: cron-only, no
-- destructive write beyond queuing digest emails, but there's no reason a
-- client should ever call it directly and no internal auth check gates it.
revoke all on function public.generate_daily_notification_digests() from public, anon, authenticated;

-- These four are `returns trigger` — Postgres itself refuses to execute a
-- trigger function outside trigger context, so granting EXECUTE to
-- anon/authenticated was never actually callable, just noise the advisor
-- correctly flags as unnecessary exposure. Revoking is a no-op for behavior
-- and closes the warning.
revoke all on function public.notify_agency_admins() from public, anon, authenticated;
revoke all on function public.clear_property24_data_on_unlink() from public, anon, authenticated;
revoke all on function public.enforce_admin_only_commission_rate() from public, anon, authenticated;
revoke all on function public.protect_user_account_sensitive_fields() from public, anon, authenticated;
