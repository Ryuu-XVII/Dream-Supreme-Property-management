-- =============================================================================
-- SECURE STORAGE BUCKETS
-- Migration: 20260730000001_secure_storage_buckets.sql
-- =============================================================================

-- Ensure the storage schema exists (provided by Supabase by default, but safe to check)
create extension if not exists "uuid-ossp";

-- 1. Register the bucket if it doesn't exist and force it to be PRIVATE
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mandate-documents',
  'mandate-documents',
  false,
  20971520, -- 20MB limit
  array['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set public = false;

-- 2. Enforce RLS on storage.objects
alter table storage.objects enable row level security;

-- Drop existing policies if any
drop policy if exists "Agency users can upload documents" on storage.objects;
drop policy if exists "Agency users can view documents" on storage.objects;
drop policy if exists "Agency users can delete documents" on storage.objects;
drop policy if exists "Agency users can update documents" on storage.objects;

-- 3. Create path-based RLS policies using public.get_current_agency_id()

-- INSERT: The user can upload if the first segment of the path matches their agency ID.
create policy "Agency users can upload documents" on storage.objects for insert
with check (
  bucket_id = 'mandate-documents' and
  (storage.foldername(name))[1] = public.get_current_agency_id()::text
);

-- SELECT: The user can view if the first segment of the path matches their agency ID.
create policy "Agency users can view documents" on storage.objects for select
using (
  bucket_id = 'mandate-documents' and
  (storage.foldername(name))[1] = public.get_current_agency_id()::text
);

-- UPDATE: The user can update if the first segment of the path matches their agency ID.
create policy "Agency users can update documents" on storage.objects for update
using (
  bucket_id = 'mandate-documents' and
  (storage.foldername(name))[1] = public.get_current_agency_id()::text
)
with check (
  bucket_id = 'mandate-documents' and
  (storage.foldername(name))[1] = public.get_current_agency_id()::text
);

-- DELETE: The user can delete if the first segment of the path matches their agency ID.
create policy "Agency users can delete documents" on storage.objects for delete
using (
  bucket_id = 'mandate-documents' and
  (storage.foldername(name))[1] = public.get_current_agency_id()::text
);
