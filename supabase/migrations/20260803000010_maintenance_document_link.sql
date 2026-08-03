-- Link documents to maintenance jobs

-- 1. Add column to document table
alter table public.document
add column if not exists maintenance_job_id uuid references public.maintenance_job(id) on delete set null;

create index if not exists idx_document_maintenance_job on public.document(maintenance_job_id);
