-- =============================================================================
-- SCHEDULED JOBS
-- Migration: 20260730000002_scheduled_jobs.sql
-- =============================================================================

-- 1. Enable the pg_cron extension
create extension if not exists pg_cron schema extensions;

-- 2. Schedule the compliance sweeps to run at 1:00 AM UTC every day
-- Note: pg_cron runs in the postgres database by default on Supabase, but we can schedule it on any db.
-- The standard syntax for Supabase pg_cron is below.
select cron.schedule(
  'daily-compliance-sweeps',
  '0 1 * * *',
  $$ select public.run_daily_sweeps(); $$
);

-- Note: To unschedule in the future, one would run:
-- select cron.unschedule('daily-compliance-sweeps');
