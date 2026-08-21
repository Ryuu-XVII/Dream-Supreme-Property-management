-- Replaces the old document_template / generate_document_from_template()
-- markdown-merge system with the new pdf_template designer
-- (20260821010000_pdf_template_designer.sql). The old system had two real
-- problems, found while building its replacement: no admin UI ever existed
-- to author a document_template row (src/data/templates.ts only ever read
-- them), and generate_document_from_template() computed the merged content
-- but never uploaded it to R2 — it inserted a `document` row pointing at a
-- storage_key nothing ever wrote to, so opening a "generated" document
-- 404'd. Both frontend consumers (src/routes/documents.tsx,
-- src/components/rentals/lease-onboarding-wizard.tsx) now generate real,
-- correctly-uploaded PDFs from pdf_template instead. Removed outright
-- rather than left dead, per the precedent in
-- 20260817000007_remove_orphaned_erp_modules.sql.
drop function if exists public.generate_document_from_template(uuid, uuid, uuid);
drop table if exists public.document_template;
