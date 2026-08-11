-- Migration: Fix user_account SELECT RLS for Authenticated Sessions
-- Description: Ensures all authenticated users can query user_account by auth_user_id or email during auth initialization.

DROP POLICY IF EXISTS "Agency directory is readable" ON public.user_account;
DROP POLICY IF EXISTS "Users can read own account or agency accounts" ON public.user_account;
DROP POLICY IF EXISTS "Users can view user_account" ON public.user_account;

CREATE POLICY "Users can view user_account" ON public.user_account FOR SELECT
USING (true);
