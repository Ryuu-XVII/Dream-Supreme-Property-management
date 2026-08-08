-- Security hardening migration: Ensure RLS is explicitly enabled for public.user_notification_preference

alter table if exists public.user_notification_preference enable row level security;

-- Ensure RLS policies exist for user_notification_preference
drop policy if exists "Users manage their own notification preferences" on public.user_notification_preference;

create policy "Users manage their own notification preferences" 
  on public.user_notification_preference 
  for all 
  using (
    user_id = public.get_current_user_account_id()
    or exists (
      select 1 from public.user_account u
      where u.auth_user_id = auth.uid()::uuid
        and u.id = user_notification_preference.user_id
    )
  )
  with check (
    user_id = public.get_current_user_account_id()
    or exists (
      select 1 from public.user_account u
      where u.auth_user_id = auth.uid()::uuid
        and u.id = user_notification_preference.user_id
    )
  );
