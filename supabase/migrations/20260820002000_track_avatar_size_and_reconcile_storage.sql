-- The per-user storage quota (user_account.storage_used_bytes) drifts from
-- reality for profile photos: replacing or removing a photo deletes the old
-- R2 object (src/components/settings/profile-photo.tsx already calls
-- removeStoredFile for it) but never decrements the byte count for it --
-- only the new upload's size was ever added, never the old one subtracted.
-- Confirmed on production: the Master Admin account has storage_used_bytes
-- = 80 with avatar_key = null and zero document rows -- a leftover test
-- avatar's bytes that were never released after it was replaced/removed.
--
-- There was no persisted size for the current avatar to decrement by, which
-- is why this was never fixed at the call site. Add it.

alter table public.user_account add column if not exists avatar_size_bytes bigint;

-- One-time reconciliation to ground truth. Every account currently has
-- avatar_key = null (confirmed on production), so the correct
-- storage_used_bytes right now is exactly the sum of documents actually
-- attributed to that user -- no avatar contribution to account for.
update public.user_account u
set storage_used_bytes = coalesce(
  (select sum(d.size_bytes) from public.document d where d.uploaded_by = u.id),
  0
)
where storage_used_bytes is distinct from coalesce(
  (select sum(d.size_bytes) from public.document d where d.uploaded_by = u.id),
  0
);
