-- Migration: Clean up invalid manual auth row by archiving
DO $$
BEGIN
  ALTER TABLE public.user_account DISABLE TRIGGER ensure_user_account_protection;
  UPDATE public.user_account SET status = 'archived' WHERE email = 'admin@dreamsupreme.co.za';
  ALTER TABLE public.user_account ENABLE TRIGGER ensure_user_account_protection;
END $$;
