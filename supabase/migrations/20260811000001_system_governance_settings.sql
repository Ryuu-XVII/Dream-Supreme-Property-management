-- System Governance & Storage Settings Schema

create table if not exists public.agency_system_setting (
  agency_id uuid primary key references public.agency(id) on delete cascade,
  global_storage_quota_mb integer not null default 1024 check (global_storage_quota_mb > 0),
  max_file_upload_mb integer not null default 50 check (max_file_upload_mb > 0),
  session_timeout_minutes integer not null default 60 check (session_timeout_minutes > 0),
  enforce_mfa boolean not null default true,
  require_admin_approval boolean not null default true,
  allowed_domains text not null default 'dreamsupreme.co.za, dreamproperty.co.za',
  notify_deal_stages boolean not null default true,
  notify_ffc_warnings boolean not null default true,
  notify_fica_uploads boolean not null default true,
  notify_commission_recon boolean not null default true,
  idle_agent_days integer not null default 90 check (idle_agent_days > 0),
  deal_archive_days integer not null default 365 check (deal_archive_days > 0),
  recycle_bin_retention_days integer not null default 30 check (recycle_bin_retention_days > 0),
  updated_at timestamptz not null default now()
);

create or replace function public.get_current_user_role()
returns text language sql stable security definer as $$
  select role::text from public.user_account
  where auth_user_id = auth.uid()
  and status = 'active'
  limit 1;
$$;

alter table public.agency_system_setting enable row level security;


create policy "Users view their agency system settings" on public.agency_system_setting
  for select using (agency_id = public.get_current_agency_id());

create policy "Admins update their agency system settings" on public.agency_system_setting
  for update using (
    agency_id = public.get_current_agency_id() 
    and public.get_current_user_role() in ('admin', 'principal')
  );

create policy "Admins insert their agency system settings" on public.agency_system_setting
  for insert with check (
    agency_id = public.get_current_agency_id() 
    and public.get_current_user_role() in ('admin', 'principal')
  );

grant select, insert, update on public.agency_system_setting to authenticated;
