-- Users can clear (delete) their own notifications from the notification bell.
drop policy if exists "Users delete own notifications" on public.notification;
create policy "Users delete own notifications" on public.notification for delete
using (user_account_id = public.get_current_user_account_id());
