-- Per-agency, per-email-type templates for the admin drag-and-drop email
-- designer (EmailBuilder.js document schema — a flat block map rendered via
-- @usewaypoint/email-builder's Reader/renderToStaticMarkup, which produces
-- table-based, inline-styled HTML the same way react-email does, so it isn't
-- stripped/mangled by Gmail/Outlook/etc.). Mirrors pdf_template's shape and
-- RLS exactly: one row per (agency, email_type), admin-only writes.
create table public.email_template (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  email_type text not null,
  name text not null,
  subject text not null,
  document jsonb not null,
  root_block_id text not null default 'root',
  updated_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, email_type)
);

alter table public.email_template enable row level security;

create policy "Agency members view email templates" on public.email_template
for select using (agency_id = public.get_current_agency_id());

create policy "Admins manage email templates" on public.email_template
for all using (
  agency_id = public.get_current_agency_id()
  and public.get_current_role() in ('admin', 'admin_agent')
) with check (
  agency_id = public.get_current_agency_id()
  and public.get_current_role() in ('admin', 'admin_agent')
);
