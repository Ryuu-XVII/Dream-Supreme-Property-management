-- =============================================================================
-- 006_tables_documents.sql
-- Documents, signatures, and supporting entities (§9, §11.1, §11.3)
-- =============================================================================

-- ─── Document ───────────────────────────────────────────────────────────────
-- Stored in Supabase Storage; this table holds metadata and references
create table public.document (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agency(id) on delete restrict,
  deal_id         uuid references public.deal(id) on delete set null,
  party_id        uuid references public.party(id) on delete set null,
  user_account_id uuid references public.user_account(id) on delete set null,
  category        public.document_category not null default 'other',
  filename        text not null,
  storage_key     text not null,  -- Supabase Storage path
  mime_type       text,
  size_bytes      bigint,
  version         int not null default 1,
  supersedes_id   uuid references public.document(id) on delete set null,
  uploaded_by     uuid references public.user_account(id) on delete set null,
  uploaded_at     timestamptz not null default now()
);
create index idx_document_agency on public.document(agency_id);
create index idx_document_deal on public.document(deal_id);

-- ─── Signature Record ──────────────────────────────────────────────────────
-- Electronic signing audit trail (§9 FR-M5-04)
create table public.signature_record (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references public.document(id) on delete restrict,
  signer_party_id     uuid references public.party(id) on delete set null,
  signer_email        text not null,
  signature_image_key text,  -- Supabase Storage path for drawn signature
  otp_verified_at     timestamptz,
  ip_address          inet,
  user_agent          text,
  document_hash       text not null,  -- SHA-256
  signed_at           timestamptz not null default now()
);
create index idx_signature_document on public.signature_record(document_id);

-- ─── Now add the deferred FK from ffc_certificate and checklist_item ───────
alter table public.ffc_certificate
  add constraint fk_ffc_document
  foreign key (document_id) references public.document(id) on delete set null;

alter table public.checklist_item
  add constraint fk_checklist_document
  foreign key (document_id) references public.document(id) on delete set null;

alter table public.mandate
  add constraint fk_mandate_document
  foreign key (document_id) references public.document(id) on delete set null;
