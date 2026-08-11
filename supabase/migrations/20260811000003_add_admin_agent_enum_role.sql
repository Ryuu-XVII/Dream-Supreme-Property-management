-- Migration: Add admin_agent to public.user_role enum
-- Description: Enables dual role (Admin & Agent) in PostgreSQL user_account and user_invitation tables.

DO $$
BEGIN
  -- Add 'admin_agent' enum value to public.user_role if it does not already exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel = 'admin_agent'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'admin_agent';
  END IF;
END $$;
