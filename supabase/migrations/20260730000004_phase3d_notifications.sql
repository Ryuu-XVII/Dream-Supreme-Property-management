-- Phase 3D: Notification Engine
create table if not exists public.notification (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  user_id uuid, -- if null, broadcast to agency
  type text not null check (type in ('system', 'deal_update', 'task_reminder', 'commission_alert')),
  subject text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification enable row level security;

-- fix: cast auth.uid() to uuid to match user.id / auth_user_id column type
create policy "Users can view their notifications" on public.notification
for select using (
  (user_id = auth.uid()::uuid or user_id is null)
  and exists (
    select 1 from public.user_account u 
    where u.auth_user_id = auth.uid()::uuid 
    and u.agency_id = notification.agency_id
  )
);

create policy "Users can mark notifications as read" on public.notification
for update using (
  (user_id = auth.uid()::uuid or user_id is null)
  and exists (
    select 1 from public.user_account u 
    where u.auth_user_id = auth.uid()::uuid 
    and u.agency_id = notification.agency_id
  )
) with check (
  (user_id = auth.uid()::uuid or user_id is null)
);

-- Email queue table
create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  recipient_email text not null,
  subject text not null,
  body_html text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- To trigger emails we can just poll this table with a chron edge function, 
-- or we can use pg_cron if available. For now we just implement the structure.
