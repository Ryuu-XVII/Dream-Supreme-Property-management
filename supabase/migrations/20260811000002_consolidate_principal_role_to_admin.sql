-- Migration: Consolidate Principal Roles to Admin
-- Description: Deprecate 'principal' and 'candidate' roles in user_account and user_invitation tables. All executive/administrative roles are consolidated under 'admin', and practitioner roles under 'agent'.

DO $$
BEGIN
  -- 1. Migrate user_account roles
  UPDATE public.user_account
  SET role = 'admin'
  WHERE role IN ('principal');

  UPDATE public.user_account
  SET role = 'agent'
  WHERE role IN ('candidate');

  -- 2. Migrate user_invitation roles
  UPDATE public.user_invitation
  SET role = 'admin'
  WHERE role IN ('principal');

  UPDATE public.user_invitation
  SET role = 'agent'
  WHERE role IN ('candidate');
END $$;
