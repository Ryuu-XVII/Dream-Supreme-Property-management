-- Phase 2 Indexing Optimization: Audit, Operations & Financial Sub-Ledger Optimization

-- 1. Audit Log Timestamp Index (agency + created_at)
create index if not exists idx_audit_log_agency_created 
  on public.audit_log (agency_id, created_at desc);

-- 2. Notification Read Status Index (user + read_at + created_at)
create index if not exists idx_notification_user_read 
  on public.notification (agency_id, created_at desc);

-- 3. Lease Invoice Due Date & Status Index
create index if not exists idx_lease_invoice_lease_due 
  on public.lease_invoice (lease_id, status, due_date);

-- 4. Trust Account Ledger Auditing Index (agency + section_type + created_at)
create index if not exists idx_trust_ledger_agency_section 
  on public.trust_account_ledger (agency_id, section_type, created_at desc);

-- 5. Email Queue Pending Dispatch Index
create index if not exists idx_email_queue_status_attempts 
  on public.email_queue (status, attempts, created_at);
