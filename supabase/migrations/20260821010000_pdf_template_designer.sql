-- Per-agency, per-document-type pdfme templates. One row per (agency,
-- document_type): editing re-saves the same row rather than versioning, since
-- there is exactly one "current" template per document type at a time.
create table public.pdf_template (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  document_type text not null,
  name text not null,
  template jsonb not null,
  updated_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, document_type)
);

alter table public.pdf_template enable row level security;

-- Any agency member can view the templates (they may need to know what a
-- generated document will look like), but only admins/admin_agents may
-- create, edit, or delete them.
create policy "Agency members view pdf templates" on public.pdf_template
for select using (agency_id = public.get_current_agency_id());

create policy "Admins manage pdf templates" on public.pdf_template
for all using (
  agency_id = public.get_current_agency_id()
  and public.get_current_role() in ('admin', 'admin_agent')
) with check (
  agency_id = public.get_current_agency_id()
  and public.get_current_role() in ('admin', 'admin_agent')
);
