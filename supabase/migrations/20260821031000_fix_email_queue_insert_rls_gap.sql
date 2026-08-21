-- email_queue has been RLS-enabled with only a SELECT policy since it was
-- created (20260730000004_phase3d_notifications.sql). Every server-side
-- producer (deal-notification triggers, the daily digest job) runs inside a
-- `security definer` function owned by a role that bypasses RLS, so those
-- inserts have always gone through silently. But the invitation flow in
-- src/routes/admin/users.tsx inserts into email_queue directly from the
-- browser client, as the `authenticated` role — which RLS does NOT bypass —
-- and supabase-js's `.insert()` doesn't throw on a policy rejection, it just
-- returns `{ error }`. That error was never checked, so every one of those
-- inserts has been silently rejected by RLS this whole time: no invitation
-- email has ever actually been queued from that code path, while the UI
-- reported success regardless. Mirrors pdf_template/email_template's
-- "Admins manage" pattern: agency-scoped, admin-only.
create policy "Admins queue agency emails" on public.email_queue
for insert
with check (
  agency_id = public.get_current_agency_id()
  and public.get_current_role() in ('admin', 'admin_agent')
);
