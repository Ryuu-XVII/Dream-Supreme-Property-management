# Release readiness

_Last updated 2026-08-21._

Status: **application layer is production-ready; release is blocked by a short list of environment provisioning items, not by missing features.**

## Implemented release controls

- Supabase Auth with invitation-only registration, a service-role-only first-principal bootstrap, and enrolled/verified TOTP MFA on login.
- Database-derived roles (`admin`, `agent`, `admin_agent`); suspended, archived, and unprovisioned accounts fail closed.
- Agency RLS on every table in `public` (verified directly against the live schema — no exceptions), accessible-deal scoping, removal of legacy permissive policies, and private document storage.
- Atomic deal creation, controlled stage transitions, mandatory reversal reasons, cancellation taxonomy, commission reversal, and clawback creation.
- Research-backed deal capture with multiple transferors/transferees, conveyancer-ready property and tax particulars, conditional finance/entity/non-resident rules, and a generated evidence checklist.
- Staged client capture with multi-role relationships, minimal POPIA-aware contact collection, separate direct-marketing consent, conditional natural-person/entity FICA fields, TFS/risk controls, duplicate checks, assignment authorization, and audited database creation.
- Persisted condition and bond updates with audit entries.
- Persisted commission snapshots and allocations with 100% split and valid-FFC gates; registration triggers calculation.
- Live dashboard, pipeline/detail, countdown, audit, leads, client, FICA, FFC, notifications, document upload, and agent earnings data paths.
- Hashed, expiring, single-use conveyancer update links.
- Public calculators with controlled lead capture, a required privacy-policy consent checkbox linking to `/privacy`, and the SARS transfer-duty schedule effective 1 April 2026.
- Production container, SPA web-server configuration, route code splitting, CI, tests, lint, type checking, production audit, and database migration CI.
- Browser code contains no object-storage or service-role credentials.
- Cloudflare R2 document storage: presigned-URL edge function confirmed live and configured against the production project.
- Admin-only, per-agency PDF (pdfme) and email (EmailBuilder.js) template designers, with real deal/agency data merged in at generate/send time — not placeholder content.
- Production Supabase Auth config pushed: minimum 8-character password with complexity requirements, required email confirmation, secure password change, and sensible per-endpoint rate limits (`auth.rate_limit` in `supabase/config.toml`).
- POPIA subject-access, export, and erasure RPCs, all admin-only and audited, including an active-deal/lease guard and a FICA 5-year retention-floor check on erasure (a party still on an open deal/lease, or whose last one concluded under 5 years ago, cannot be erased).

## Must be completed in the target environment

- [ ] **Outbound email is fully wired but cannot send: no secrets are configured.** `send-queued-emails` (the SMTP dispatch Edge Function) returns "Missing required secrets" when invoked — `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` were never set. Separately, Supabase Vault has zero secrets stored, so `trigger_email_queue_dispatch()` (running every 5 minutes via `pg_cron`, confirmed active) no-ops every time — `email_dispatch_function_url` and `email_dispatch_service_key` were never populated. Every invitation, deal notification, and daily digest since the platform existed is sitting unsent in `email_queue`. This needs real SMTP relay credentials before it can be closed out; templates, merge logic, and dispatch code are done and verified live.
- [ ] Register the production domain and update `site_url`/`additional_redirect_urls` in `supabase/config.toml` (currently pinned to `localhost` with an explicit TODO — pushing a wrong or premature redirect allow-list is a real security risk, so this needs the actual registered domain, not a placeholder).
- [ ] Configure a CAPTCHA provider (`auth.captcha` in `supabase/config.toml` is present but commented out) — needs a real hCaptcha or Turnstile secret.
- [ ] Provision the production Supabase project and run the database CI/reset against staging, if not already the live project.
- [ ] Bootstrap the first principal, then test Admin, Agent, Admin & Agent, suspended, and cross-agency access.
- [ ] Populate and approve the agency's commission rule lines, branches, conveyancers, users, and opening FFC records.
- [ ] Configure HTTPS, DNS, monitoring, error reporting, backup/PITR, restoration testing, and POPIA retention procedures.
- [ ] Run user acceptance tests with real but non-production sample transactions from mandate through registration, commission, cancellation, and clawback.
- [ ] Obtain written legal approval of templates, FICA workflow, POPIA wording, retention periods, and permitted e-sign document categories (see `COMPLIANCE_AUDIT_2026-08-19.md` and `LEGAL_REVIEW_PACKAGE.md` — one open item remains: no destruction schedule exists for data past its retention purpose, since nothing currently hard-deletes anything; this is a policy decision, not an engineering gap).

## Deliberately unavailable at release

- Electronic signing is fail-closed. The existing screen cannot issue a fake OTP or persist a fake signature. Enable only after a server-side OTP and signing-token implementation, immutable artefact storage/hashing, event capture, and legal approval are delivered. The UI also does not yet distinguish documents that legally require an Advanced Electronic Signature (e.g. Offers to Purchase, under the Alienation of Land Act) from ones that don't — that distinction must exist before e-signing is enabled for any document type.

These exclusions are visible release boundaries, not silent mock behaviour. They should be separately scoped if they are required for the first production launch.
