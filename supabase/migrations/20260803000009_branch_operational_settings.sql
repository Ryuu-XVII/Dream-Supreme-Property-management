-- 20260803000009_branch_operational_settings.sql
-- Add granular lead assignment control to branches

alter table public.branch 
  add column if not exists lead_auto_assign boolean not null default false;

-- Add a comment to describe the field
comment on column public.branch.lead_auto_assign is 'If true, new leads matching this branch will be automatically round-robined to eligible agents.';
