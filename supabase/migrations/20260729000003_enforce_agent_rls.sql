-- =============================================================================
-- ENFORCE AGENT RLS
-- Migration: 20260729000003_enforce_agent_rls.sql
-- =============================================================================

drop policy if exists "Users can view and manage deals in their agency" on public.deal;

create or replace function public.is_principal_or_admin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from public.user_account
    where auth_user_id = auth.uid()
    and role in ('principal', 'admin')
    and status = 'active'
  );
$$;

create or replace function public.get_current_user_account_id()
returns uuid language sql stable security definer as $$
  select id from public.user_account
  where auth_user_id = auth.uid()
  and status = 'active'
  limit 1;
$$;

create policy "Deal role based access" on public.deal for all
using (
  agency_id = public.get_current_agency_id() 
  and (
    public.is_principal_or_admin() 
    or id in (select deal_id from public.deal_participant where user_account_id = public.get_current_user_account_id())
    or created_by = public.get_current_user_account_id()
  )
)
with check (
  agency_id = public.get_current_agency_id()
);
