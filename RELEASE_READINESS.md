# Release readiness

Status: **repository ready for a staging deployment; production release is blocked by environment provisioning and acceptance testing.**

## Implemented release controls

- Supabase Auth with invitation-only registration and a service-role-only first-principal bootstrap.
- Database-derived roles; suspended, archived, and unprovisioned accounts fail closed.
- Agency RLS, accessible-deal scoping, removal of legacy permissive policies, and private document storage.
- Atomic deal creation, controlled stage transitions, mandatory reversal reasons, cancellation taxonomy, commission reversal, and clawback creation.
- Research-backed deal capture with multiple transferors/transferees, conveyancer-ready property and tax particulars, conditional finance/entity/non-resident rules, and a generated evidence checklist.
- Persisted condition and bond updates with audit entries.
- Persisted commission snapshots and allocations with 100% split and valid-FFC gates; registration triggers calculation.
- Live dashboard, pipeline/detail, countdown, audit, leads, client, FICA, FFC, notifications, document upload, and agent earnings data paths.
- Hashed, expiring, single-use conveyancer update links.
- Public calculators with controlled lead capture and the SARS transfer-duty schedule effective 1 April 2026.
- Production container, SPA web-server configuration, route code splitting, CI, tests, lint, type checking, production audit, and database migration CI.
- Browser code contains no object-storage or service-role credentials.

## Must be completed in the target environment

- [ ] Provision the production Supabase project and run the database CI/reset against staging.
- [ ] Configure Auth production URL, redirect allow-list, password policy, CAPTCHA/rate limits, and SMTP.
- [ ] Bootstrap the first principal, then test Principal, Admin, Agent, Candidate, suspended, and cross-agency access.
- [ ] Configure the daily `run_daily_sweeps()` service-role schedule and the outbound email worker/adapter.
- [ ] Populate and approve the agency's commission rule lines, branches, conveyancers, users, and opening FFC records.
- [ ] Configure HTTPS, DNS, monitoring, error reporting, backup/PITR, restoration testing, and POPIA retention procedures.
- [ ] Run user acceptance tests with real but non-production sample transactions from mandate through registration, commission, cancellation, and clawback.
- [ ] Obtain written legal approval of templates, FICA workflow, POPIA wording, retention periods, and permitted e-sign document categories.

## Deliberately unavailable at release

- Electronic signing is fail-closed. The existing screen cannot issue a fake OTP or persist a fake signature. Enable only after a server-side OTP and signing-token implementation, immutable artefact storage/hashing, event capture, and legal approval are delivered.
- Outbound email/WhatsApp delivery is adapter work. The system persists in-app notifications and schedule-ready queue records, but does not pretend an email was sent.
- PDF/DOCX report and template generation requires a server worker. UI-only “queued” actions must not be treated as delivered reports during UAT.

These exclusions are visible release boundaries, not silent mock behaviour. They should be separately scoped if they are required for the first production launch.
