-- Migration: Clean up invalid manual auth row
DELETE FROM public.user_account WHERE email = 'admin@dreamsupreme.co.za';
DELETE FROM auth.users WHERE email = 'admin@dreamsupreme.co.za';
