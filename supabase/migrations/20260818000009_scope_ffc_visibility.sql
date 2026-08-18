-- Migration: An agent may only see their own Fidelity Fund Certificate
-- Description: `ffc_certificate` carried two permissive SELECT policies:
--
--   "Agency FFCs are readable"       — any agency member, no role check
--   "Users view own or agency FFCs"  — own record, or an administrator's view
--                                      of the agency
--
-- Postgres ORs permissive policies together, so the first one governed and the
-- second was dead weight: every agent could read every colleague's FFC number
-- and expiry. That is exactly what the intentionally stricter policy was
-- written to prevent, so the broad one is dropped rather than the two being
-- reconciled.
--
-- Administrators keep the agency-wide view through the surviving policy, which
-- backs Admin > Compliance. Nothing else reads this table agency-wide: the
-- FFC checks inside calculate_deal_commission run in SECURITY DEFINER
-- functions, which bypass RLS entirely.

drop policy if exists "Agency FFCs are readable" on public.ffc_certificate;

-- Left in place, restated here so the intended rule is visible in one file:
--   "Users view own or agency FFCs"
--     using (user_account_id = get_current_user_account_id()
--            or (get_current_role() in ('admin','admin_agent')
--                and the certificate belongs to the caller's agency))
