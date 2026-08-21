# Legal Review Package

Compiled 2026-08-19 for external legal review before production launch. This maps
each regulatory requirement in `documentation/technical/COMPLIANCE.md` to what is
actually implemented in the codebase today, so review time goes into judging real
behaviour rather than re-reading the spec. This is a factual summary, not a legal
opinion — nothing here should be treated as sign-off.

## 1. FICA (Financial Intelligence Centre Act) — AML & KYC

**Implemented:**
- Identity/address capture and a `Pending` / `Verified` / `Rejected` FICA status
  per party, gating deal progression to financial stages (`src/lib/deal-capture.ts`,
  `src/routes/compliance/fica.tsx`).
- FICA approval/rejection is written to `public.audit_log` with actor and timestamp.
- Risk rating (Low/Medium/High), PEP/DPIP flags, and source-of-funds tracking exist
  on the party record.

**Needs legal review:** whether the captured field set and risk-rating criteria
meet the accountable-institution obligations for this agency's specific risk
appetite (this was implemented from the internal requirements doc, not a
FICA compliance officer's sign-off).

## 2. POPIA (Protection of Personal Information Act)

**Implemented:**
- Consent capture is separate from contact capture (`src/lib/client-onboarding.ts`),
  with direct-marketing consent tracked independently of transactional data
  collection.
- A subject-access/erasure workflow exists at `/compliance/popia`
  (`public.popia_lookup_party`, `public.popia_erase_party_data`): erasure redacts
  `full_name`, `email`, `mobile`, and `id_or_reg_number` on the `party` row rather
  than deleting it, and logs the erasure to `audit_log`. Restricted to
  `admin`/`admin_agent` roles.
- Hard deletes are blocked at the database level — `public.prevent_hard_delete()`
  is a trigger that raises on any DELETE against protected tables, so data cannot
  be destroyed outside the audited erasure path.

**Resolved (2026-08-21):** `popia_erase_party_data` now blocks erasure while a
party is on an active deal or lease, and otherwise refuses to erase until 5
years have passed since their most recent concluded deal/lease (raising an
exception naming the exact eligible date). A party who never actually
transacted can still be erased immediately.

## 3. Data Retention

**Implemented:** Hard deletes are disabled platform-wide (see above), so
transactional and identity data is never destroyed by any app code path — the
FICA 5-year minimum is trivially satisfied by "never delete." A separate,
admin-configurable `recycle_bin_retention_days` (default 30) controls when
*archived* (soft-deleted) records are purged by `admin_empty_recycle_bin` —
this is a housekeeping control, not a POPIA-driven destruction schedule.

**Gap to flag:** there is no automated process that actually destroys data once
its FICA retention period *has* elapsed — POPIA's "destroy when no longer
needed" obligation currently has no enforcement path at all, since deletion is
structurally disabled. This is a reasonable default (safe against premature
deletion) but leaves the destruction side of the retention policy as a manual,
undocumented process.

## 4. ECTA (Electronic Communications and Transactions Act)

**Implemented:** the UI for mandates/leases points to native click-to-sign
(`src/routes/sign.tsx`, `esign_envelope`/`esign_envelope_recipient` tables).

**Not implemented — deliberately fail-closed** (see `RELEASE_READINESS.md`):
- No server-side OTP verification for signers.
- No cryptographic (SHA-256) hashing of the completed signed artefact — the
  compliance doc requires this to prove non-tampering; it does not exist yet.
- No distinction is enforced in the UI between documents eligible for a standard
  e-signature (mandates, leases) versus an Offer to Purchase, which under the
  Alienation of Land Act requires an accredited Advanced Electronic Signature or
  wet-ink signature. The screen does not currently warn or block OTP signing.

**Action needed before enabling e-signing in production:** implement OTP +
artefact hashing, add the OTP-signature-category restriction, and only then
seek legal sign-off to turn the feature on. Today it is intentionally inert
(cannot issue a real signature), so there is no live legal exposure from it.

## What to send a lawyer

1. This document.
2. `documentation/technical/COMPLIANCE.md` (the requirements it was built against).
3. `documentation/requirements/CLIENT_ONBOARDING_REQUIREMENTS.md` and
   `DEAL_CAPTURE_REQUIREMENTS.md` (what data is actually captured and when).
4. The remaining open gap flagged above (no destruction schedule) — a policy
   decision (what "no longer needed" means per data type) more than an
   engineering task, needed before launch.
