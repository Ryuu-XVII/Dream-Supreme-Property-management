-- Phase 4: User Notification Overrides
create table if not exists public.user_notification_preference (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_account(id) on delete cascade,
  event_type text not null,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(user_id, event_type)
);

alter table public.user_notification_preference enable row level security;

create policy "Users manage their own notification preferences" 
  on public.user_notification_preference 
  for all using (user_id = public.get_current_user_account_id());
