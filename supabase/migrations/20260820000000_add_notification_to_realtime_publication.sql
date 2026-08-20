-- The header bell (src/components/layout/header.tsx) subscribes to
-- postgres_changes INSERT events on public.notification to toast new
-- notifications live and bump the unread badge without a reload. That
-- subscription can only ever receive events for tables actually added to
-- the supabase_realtime publication -- and public.notification was never
-- added to it (no prior migration does so, and the live publication had
-- zero tables in it). The subscribe() call always succeeds regardless, so
-- this failed silently: notifications only ever appeared after a manual
-- page reload re-ran the one-time fetch, never live while already on the
-- page, which is exactly the intermittent "don't always work" symptom.

alter publication supabase_realtime add table public.notification;
