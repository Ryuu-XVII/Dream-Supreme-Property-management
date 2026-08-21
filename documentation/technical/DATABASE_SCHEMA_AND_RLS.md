# Database Schema & RLS Policies

Dream Supreme is a multi-tenant platform. Supabase handles authentication, and PostgreSQL Row Level Security (RLS) guarantees complete multi-tenant data isolation across all tables including `config_transfer_duty`, `email_queue`, and validated `lead` insertions requiring `full_name`.

## 1. Core Entity Schema

### `agency` & `user_account`

- **`agency`**: The top-level tenant.
- **`branch`**: Physical office locations belonging to an agency. Tracks granular operational settings like `lead_auto_assign`.
- **`user_account`**: Links a Supabase Auth `user` to a specific `agency` and optionally a `branch`. Contains the user's operational role (`admin`, `agent`, `admin_agent` dual role) and `last_login_at` for idle agent tracking.
- **`commission_pct`**: (Recently added) Stores an agent's individual commission split. If `NULL`, the system falls back to the agency's default rules.

### `property`, `mandate`, & `deal`

- **`property`**: The physical real estate asset. Independent of the transaction. Its street address column is `address_line`, not `address`.
- **`mandate`**: The exclusive or open listing agreement to sell/rent a `property`. Tracks listing price and expiry. `seller_party_id` and `listing_agent_id` (added in `20260814000004_lightweight_mandate_registration.sql`) let a mandate stand on its own, independent of any `deal` — a mandate is pre-legal listing intake and doesn't require a purchaser or signed OTP to exist.
- **`deal`**: The transactional workflow. Links a `property` (and optionally a `mandate`) to `user_account`s (via `deal_participant`). Moves through strict stages (e.g., `Mandate Signed` -> `OTP Signed` -> `Registered`). Deals can now be put into an `'archived'` status when older than 3 years. `document.mandate_id` lets uploads attach directly to a mandate before a deal exists.

### `user_notification_preference` & `notification` (Notification System)

- **`user_notification_preference`**: Tracks user-level event notification preferences, frequency ('realtime' vs 'digest'), and custom condition configurations.
- **`notification`**: Stores in-app and email notifications with delivery statuses ('sent', 'pending_digest', 'digest_queued').

### `trust_account_ledger` & `document_template` (Trust & Compliance Operations)

- **`trust_account_ledger`**: Audited sub-ledger for Section 86(2) General and Section 86(4) Investment trust deposits, managing 95%/5% client vs PPRA statutory interest allocations and administrator sign-offs.
- **`document_template`**: Template repository for auto-generating ECTA-compliant mandates, lease agreements, and OTP legal documents. Markdown/`{{merge_field}}` based (`generate_document_from_template()`), read-only from the frontend (`src/data/templates.ts`) — there is no admin authoring UI for these, and the generation RPC never actually writes the merged file to R2 despite inserting a `document` row pointing at a `storage_key` (see finding 27, below).
- **`pdf_template`**: A separate, unrelated system — one row per (`agency_id`, `document_type`), storing a [pdfme](https://pdfme.com) visual-designer `Template` (JSONB: `basePdf` + drag-and-drop `schemas`). Admin-only via RLS (`get_current_role() in ('admin','admin_agent')`); any agency member may read. Backs the admin PDF Templates screen (`src/routes/admin/pdf-templates/`) — see finding 27.

### `notification`, `notification_preference`, `user_notification_preference` & `email_queue` (System & User Alert Engine)

- **`notification`**: In-app and agency-wide system alerts supporting user-specific (`user_id` / `user_account_id`) and broadcast channels.
- **`notification_preference`**: Agency-wide settings defining the default channels (email vs. in-app) for different events (e.g., deal updates). Supports JSONB `condition_config` thresholds.
- **`user_notification_preference`**: User-level overrides for the agency defaults. Allows individuals to toggle on/off emails/in-app alerts, define JSONB `condition_config`, and choose delivery `frequency` ('realtime' vs 'digest').
- **`email_queue`**: Transactional email dispatch queue for automated compliance, deal updates, and task reminders.

### `commission_rule_set`, `commission_calculation`, & `agency_system_setting`

- **`commission_rule_set`**: Defines global agency rules (e.g., Office Share %, Franchise Fees, Marketing Deductions). Bounded by database `CHECK` constraints ensuring `default_commission_rate_bps` and `office_share_bps` remain within `0` and `10000` (0% to 100%).
- **`commission_rule_line`**: Specific deduction line items within a rule set. Bounded by database `CHECK` constraints on `rate_bps` (0–10000) and `fixed_amount_cents >= 0` to prevent negative deductions.
- **`commission_calculation`**: Triggered when a deal registers. Calculates the gross commission, subtracts deductions, and allocates the remaining net commission to the agents (`commission_allocation`).
- **`agency_system_setting`**: Stores agency-wide System Governance configurations (Global agent storage quota limit MB, single upload ceiling MB, session idle timeouts, MFA enforcement, registration approval policies, automated event notification toggles, and archival/idle agent maintenance retention windows). RLS restricts reads/writes to agency members and admins.

### `rate_limit_hit` (Rate Limiting)

Tracks call counts for anon-callable public RPCs (`submit_public_lead`, `get_status_request`, `submit_conveyancer_status`, `create_user_invitation`, `validate_user_invitation`, `prepare_invited_registration`, `get_current_transfer_duty_brackets`, plus the e-sign signer RPCs), keyed by the identity already present in each call's own parameters (email/token) since PostgREST does not forward caller IP into RPCs. RLS enabled with no policies (default-deny) — only the `check_rate_limit()` `SECURITY DEFINER` function touches it. Added in `20260817000000_rate_limiting.sql`.

### `esign_envelope_recipient` (Click-to-Sign E-Signatures)

Per-recipient anonymous-access token for the self-built e-signature flow, mirroring the `status_request_token` pattern: `token_hash`, `expires_at`, `signed_at`, `declined_at`. `esign_envelope`/`esign_audit_log` (from `20260803000004_transaction_and_esign_schema.sql`) already had agency-scoped RLS, but that only covers authenticated agency users — a signer opening `/sign?token=...` has no Supabase Auth session, so this table plus the `SECURITY DEFINER` RPCs below are what actually let signing happen. `signature_record` intentionally has no insert/update policy for any role — all writes go through `submit_esign_signature()`. Added in `20260817000001_esign_signing_flow.sql`.

## 2. Migration Ordering Strategy

All Supabase schema migrations are stored sequentially in `supabase/migrations/` using 14-digit ISO-like UTC timestamps (`YYYYMMDDhhmmss_description.sql`).
Migration timestamps are strictly unique to guarantee deterministic execution order during `supabase db reset` and automated CI database pipelines.

## 3. Database Indexing & Performance Strategy

High-cardinality multi-tenant composite B-tree indexes are implemented across core entities:

- `idx_user_account_agency_auth`: Multi-tenant user auth resolution (`agency_id`, `auth_user_id`).
- `idx_property_agency_type`: Property filtering & sorting (`agency_id`, `property_type`, `created_at DESC`).
- `idx_mandate_agency_property`: Listing lookup (`agency_id`, `property_id`, `status`).
- `idx_deal_agency_stage`: Pipeline stage sorting (`agency_id`, `stage`, `created_at DESC`).
- `idx_deal_participant_deal_user`: Deal participant lookup (`deal_id`, `user_account_id`).
- `idx_audit_log_agency_occurred`: Audit log chronological query (`agency_id`, `occurred_at DESC`).
- `idx_notification_user_read`: Notification feed (`agency_id`, `created_at DESC`).
- `idx_lease_invoice_lease_due`: Rental invoice billing status (`lease_id`, `status`, `due_on`).
- `idx_lease_payment_ref`: Auto-matching for bank feed reconciliations (`payment_reference`).
- `idx_trust_ledger_agency_account`: Trust sub-ledger compliance (`agency_id`, `account_type`, `created_at DESC`).
- `idx_email_queue_status_attempts`: Email queue dispatcher (`status`, `attempts`, `created_at`).
- `idx_party_agency_fica_status`: FICA compliance status (`agency_id`, `fica_status`, `party_type`).
- `idx_ffc_certificate_user_expires`: FFC certificate status & expiry (`user_account_id`, `expires_on DESC`).
- `idx_party_agency_name`: Party search by name (`agency_id`, `full_name`).
- `idx_document_agency_deal`: Document deal & category association (`agency_id`, `deal_id`, `category`).
- `idx_document_user_account_category`: User compliance document lookup (`agency_id`, `user_account_id`, `category`, `uploaded_at DESC`).
- `idx_document_maintenance_job`: Links photo evidence to a maintenance job (`maintenance_job_id`).
- `idx_commission_allocation_calc_user`: Commission allocation payee (`calculation_id`, `user_account_id`).

## 4. Row Level Security (RLS) Strategy

All tables enforce RLS to guarantee data boundaries. All policy comparisons against `auth.uid()` enforce explicit `::uuid` type casting (`auth.uid()::uuid = auth_user_id`) to prevent PostgreSQL type mismatch errors.

### Multi-Tenant Isolation

Every table (except `agency`) has an `agency_id` column. A PostgreSQL helper function `public.get_current_agency_id()` securely extracts the user's agency from their JWT.
Most SELECT policies start with: `agency_id = public.get_current_agency_id()`.

### Role-Based Access Control (RBAC)

Another helper `public.get_current_role()` extracts the user's role from their `user_account`.

- **Admins**: Can view, edit, and delete almost all records within their `agency_id`. Includes both the plain `admin` role and the dual-role `admin_agent`.
- **Agents**: Can only view and edit records they are explicitly assigned to (e.g., a `deal` where they exist in `deal_participant`).

**`is_manager()` vs `get_current_role()`**: `public.is_manager()` is the correct helper for any "is this caller a manager?" check — it recognizes `admin`, `admin_agent`, and `admin & agent` (dual-role) accounts. `get_current_role() in ('admin', 'admin_agent')` misses dual-role accounts entirely and previously caused `create_deal`, `create_client`, and (pre-emptively, in `create_mandate`) to wrongly block a legitimate manager from reassigning a record; all three now use `is_manager()`.

**`principal`/`candidate` role removal (`20260817000006_remove_principal_candidate_roles.sql`)**: the `user_role` enum still defines legacy `principal` and `candidate` values, but only `agent`, `admin`, and `admin_agent` accounts are ever issued (a prior migration, `20260811000002_consolidate_principal_role_to_admin.sql`, already converted every existing row away from them). This migration strips the resulting stale `'principal'`/`'candidate'` literal from every live RLS policy and RPC across the schema. Several of those checks required a role that could no longer exist and were silently broken as a result — `save_commission_rule_set` (no one could edit commission rules), `transition_deal`'s stage-override gate, `process_monthly_section_86_4_interest_allocation`'s approver lookup, and the admin notification broadcasts in `run_daily_sweeps`/`notify_agency_admins` — all now correctly recognize `admin`/`admin_agent` again. The enum type itself is left untouched (Postgres can't drop an enum value without recreating every dependent function signature); the `principal`/`candidate` labels remain defined but unreachable through any code path.

**`save_commission_rule_set` VAT Enum Cast (`20260818000000_fix_save_commission_rule_set_vat_cast.sql`)**: Explicitly casts the `CASE` statement output evaluating `vatInclusive` boolean to `::public.vat_treatment` to prevent PostgreSQL type mismatch errors (`vat_treatment` vs `text`) when inserting or updating commission rule sets.

**`calculate_deal_commission` Rule Set Fallback (`20260818000001_fix_commission_ruleset_lookup_fallback.sql`)**: Implements multi-tier fallback resolution for commission rule sets when transitioning deals to `registered`. If no default rule set covering the exact registration date is found, it gracefully falls back to: (1) any active rule set covering the registration date, (2) any default rule set for the agency, and (3) the most recent rule set for the agency.

**FFC Check & Admin Override Propagation (`20260818000002_fix_ffc_check_and_override_propagation.sql`, `20260818000003_fix_document_category_enum_in_ffc_check.sql` & `20260818000004_robust_ffc_lookup.sql`)**: Enhances practitioner FFC verification during deal registration by recognizing valid `ffc_certificate` date ranges, user account correlation (via ID, email, or name matching), uploaded compliance documents (`category = 'ffc_certificate'::public.document_category`), PPRA reference numbers, and existing certificate records. Also propagates `p_override` from `transition_deal` through to `calculate_deal_commission`, ensuring administrator stage-gate overrides are honored without blocking commission calculations.

> **Provenance note.** These five migrations (`20260818000000`–`20260818000004`) were applied to the linked Supabase project before they were committed: they existed only in one developer's working copy, so `git ls-files` did not know about them and no clone of this repository could rebuild the schema production was actually running. They are now tracked. This is the same class of problem as the function drift described in §14, and it is what the `npm run check:drift` guard exists to catch — note that the guard compares the live database against migration *files on disk*, so it will not flag a migration that is present locally but uncommitted. Only CI, running from a clean checkout, catches that case.

### `managed_by` Edit Rights (Rentals)

For the Rentals module, read access is granted to the entire agency for transparency, but write/edit access on a `lease` (and its invoices/maintenance) is strictly limited to the `managed_by` agent via the `public.can_edit_lease()` RLS helper function.

## 3. Remote Procedure Calls (RPCs)

We utilize Postgres functions (RPCs) to handle complex transactions that require strict data integrity and audit logging.

### `calculate_deal_commission(p_deal_id, p_rule_set_id)`

Calculates the exact net payable amounts for all participants on a deal using a cascading waterfall approach. Supports dynamically calculating franchise/marketing fees based on the remaining commission pool (`percentage_of_remaining`). Re-runnable (archives previous calculations). Restricted to Admins (including `admin_agent`).

### `get_vat_rate()`

A central configuration function that returns the current VAT rate (`0.15`). Used consistently by the commission calculations to prevent hardcoded VAT percentages.

### `record_trust_transaction(p_deal_id, p_lease_id, p_account_type, p_transaction_type, ...)`

Enforces admin-only approval for Section 86 trust sub-ledger transactions, automatically stamping approval metadata and writing structured records to `audit_log`.

### `process_monthly_section_86_4_interest_allocation(p_agency_id, p_period_date)`

Calculates statutory 95%/5% interest splits on Section 86(4) trust investment balances under the Property Practitioners Act 22 of 2019. Automatically posts dual ledger transactions (`interest_credit` and `ppra_levy_deduction`), logs audit trail entries, and generates administrator notifications. Scheduled via `pg_cron` (`0 1 1 * *`).

### `review_compliance_item(p_checklist_id, p_status, p_rejection_notes)`

Enforces agency admin approval or rejection of mandatory transaction compliance checklist items (FICA, PPA Section 67 disclosure, FFC validation), recording review status and audit timestamps.

### `assign_lead_round_robin(p_lead_id)`

Distributes incoming omnichannel leads dynamically among active agents using an automated round-robin algorithm based on current active lead count and creation timestamps.

### `approve_maintenance_work_order(p_ticket_id, p_contractor_amount_cents)`

Enforces agency admin approval for tenant maintenance work orders and contractor quotes, updating ticket status and auto-logging contractor invoice deductions for landlord trust disbursements.

### `generate_document_from_template(p_template_id, p_deal_id, p_lease_id)`

Executes server-side document merge substitution on template markdown, creates the generated document entry in `public.document`, and logs an automated audit entry.

### `create_mandate(p_payload jsonb)`

Registers a bare property mandate: `property` + a seller `party` + listing terms only (added in `20260814000004_lightweight_mandate_registration.sql`). Deliberately separate from `create_deal`, which requires a purchaser and FICA/OTP-grade party data that doesn't exist yet at listing intake. The Mandates Register's "New Listing" flow and the `/mandates/new` wizard both call this instead of `create_deal`. "Convert to Deal" (`/deals/new?mandateId=...`) later prefills a full deal capture from the mandate's `property`/`seller_party_id`/terms.

**Convert-to-deal duplication fix (`20260817000005_fix_convert_mandate_duplication.sql`)**: the client already prefilled from and sent a `sourceMandateId` on conversion, but `create_deal()` never read it — every conversion unconditionally inserted a brand-new `property` + `mandate`, leaving the original mandate behind as an orphaned duplicate in the Mandate Register. `create_deal()` now reuses (updates in place) the source mandate's `property_id`/`mandate_id` when `sourceMandateId` is present, instead of inserting new rows. Behavior for deals captured without a source mandate is unchanged.

### `check_rate_limit(p_key text, p_max_attempts int, p_window interval)`

Counts `rate_limit_hit` rows for `p_key` within `p_window`; returns `false` (and does not record a hit) once `p_max_attempts` is reached, else records the hit and returns `true`. `SECURITY DEFINER`, called from inside the anon-callable RPCs listed above. Added in `20260817000000_rate_limiting.sql`.

### `create_esign_envelope_recipient` / `get_esign_envelope_for_signing` / `submit_esign_signature` / `decline_esign_envelope`

The click-to-sign flow: an authenticated agency user calls `create_esign_envelope_recipient` to mint a signer token; the anonymous signer's `/sign?token=...` page calls `get_esign_envelope_for_signing` (logs an `esign_audit_log` `'viewed'` entry) then `submit_esign_signature` (verifies the client-supplied document hash against `esign_envelope.payload_sha256`, writes `signature_record` + `esign_audit_log` `'signed'`, and flips `esign_envelope.status` to `partially_signed`/`completed`) or `decline_esign_envelope`. The two signer-facing RPCs are wrapped in `check_rate_limit`. Added in `20260817000001_esign_signing_flow.sql`.

### `popia_lookup_party` / `popia_export_party_data` / `popia_erase_party_data`

Staff-only (`authenticated`, admin/admin_agent gated), agency-scoped POPIA data-subject-access tooling surfaced at `/compliance/popia`. Lookup searches `party` by name/email/ID and returns linked-record counts; export aggregates `party` + related `document`/`signature_record`/`lead` rows to JSON; erase immediately anonymizes `party.full_name`/`email`/`mobile`/`id_or_reg_number` (manual trigger only, no auto-expiry) while leaving financial/deal/audit-linked foreign keys intact for FICA/tax retention. Both export and erase log to `audit_log` via new `audit_action` enum values `'popia_export'`/`'popia_erasure'`. Added in `20260817000002_popia_workflow.sql`.

### `trigger_email_queue_dispatch()`

Calls the `supabase/functions/send-queued-emails` Edge Function via `pg_net`/`net.http_post` (reading the function URL and service-role key from Supabase Vault, never hardcoded in SQL), scheduled every 5 minutes via `pg_cron`. This is the first consumer `email_queue` has ever had — `generate_daily_notification_digests()` and the invitation flow already produced rows, but nothing sent them until now. The Edge Function sends via SMTP (reusing the same relay configured for Supabase Auth). Added in `20260817000003_email_queue_dispatch.sql`, which also tightened `generate_daily_notification_digests()`'s aggregate-building loop.

### `create_lease_onboarding(p_payload jsonb)`

Executes atomic lease onboarding, inserting the `lease` record, trust deposit ledger entries, initial pro-rata rent invoice, and ingoing inspection schedule in a single audited transaction.

### `admin_bulk_retire_users(p_user_ids)`

Changes multiple users' statuses to `'archived'` securely in one transaction and automatically writes to the `audit_log`.

### `admin_bulk_reset_commission(p_user_ids)`

Sets an array of users' `commission_pct` to `NULL`, forcing them to inherit the default agency rules again. Writes to the `audit_log`.

### `generate_daily_notification_digests()`

Aggregates all notifications with a `delivery_status` of `'pending_digest'` for users who have opted into digest frequency. Generates a combined HTML email and inserts it into `email_queue`. Scheduled via `pg_cron` at 08:00 UTC daily.

### `adjust_user_storage_usage(target_user_id, bytes_delta)`

Adjusts a user's `storage_used_bytes` by `bytes_delta` (clamped to a minimum of zero), called from the client after each successful document/avatar/certificate upload to `mandate-documents` so per-user storage quotas (`storage_limit_bytes`) reflect real usage. `security definer`, but restricted in-function to the caller adjusting their own usage, or an `admin`/`admin_agent` caller adjusting anyone's — a caller cannot pass an arbitrary `target_user_id` to alter another user's usage.

## 4. Triggers & Automation

- **`deal_stage_history`**: A Postgres trigger automatically records an entry in `deal_timeline` whenever a deal's `stage` column is updated.
- **`notify_agency_admins()` Trigger**: An automated trigger on `public.deal` and `public.audit_log` that instantly broadcasts in-app notifications (`public.notification`) and enqueues HTML email notifications (`public.email_queue`) to all agency `admin`/`admin_agent` accounts whenever a deal is registered (closed), cancelled, transitioned, or tagged with an operational progress note. Fixed in `20260814000005_fix_deal_notification_address_column.sql`, which also fired on every `deal` insert: it queried `property.address`, a column that has always been named `address_line`, so it broke every deal creation until fixed. Its `role in ('admin', 'principal')` recipient filter was also stale — fixed in `20260817000006_remove_principal_candidate_roles.sql` (see §3 RBAC).
- **`audit_log`**: Crucial actions (like commission finalization, user archival, entity updates) write to `audit_log` for complete financial transparency. `action` is a `public.audit_action` enum; `20260814000006_add_progress_note_audit_action.sql` added the `'progress_note_added'` value that `notify_agency_admins()` compared against — the missing value broke the cast on **every** `audit_log` insert app-wide (not just progress notes) until fixed.
- **`pg_cron` (Scheduled Jobs)**: Used for automated daily background tasks. For example, `run_daily_sweeps()` runs every night at midnight to check all FFC certificates and automatically suspends accounts if their FFC has expired.

## 5. User Invitations & Security Functions

- **`create_user_invitation(text, user_role)`**: Generates a secure invite token, automatically cleans up prior unaccepted invitations for the target email, auto-provisions a default agency if needed, enforces `admin`/`admin_agent` authorization checks and rejects any `p_role` outside `agent`/`admin`/`admin_agent`, revokes public/anonymous execution, and grants `EXECUTE` to authenticated callers only.
- **`prepare_invited_registration(text, text)`**: Validates an invitation token and email pairing, detects any orphan Supabase `auth.users` rows created by prior incomplete registration attempts, automatically cleans them up server-side, and returns validation status. Granted `EXECUTE` to `anon` and `authenticated`.
- **`validate_user_invitation(text, text)`**: Validates invite token and email pairing with `EXECUTE` granted to `anon`, `authenticated`, and `service_role`.
- **`accept_user_invitation(text, text, text, text)`**: Completes registration by creating/updating the `user_account` profile (with `ON CONFLICT` handling for existing auth users) and marking the invitation as accepted.
- **`user_invitation` & `user_account` RLS Policies**: Updated `SELECT` policies to ensure agency directories and pending invitations remain queryable by managers and active agency accounts.
- **Client Session Gate**: The React root guard requires a valid session plus an active `user_account` before rendering operational routes. This is defense in depth; PostgreSQL RLS remains the authoritative data boundary.
- **Master Admin & Domain Separation**: The seed migration `20260807000000_seed_master_admin.sql` provisions the system master admin account (`admin@dreamsupreme.co.za`) in `public.user_account` with `admin` role and active status. Domain-based routing (`isAdminDomain()`) segregates the executive portal (`admin.localhost:5173`) from the agency portal (`localhost:5173`), with local session fallback handling (`setMasterAdminAccount`) ensuring seamless administration access.
- **`user_notification_preference` RLS Enforcement**: Secured via migration `20260809000000_enable_rls_user_notification_preference.sql` with strict row-level policies permitting users to manage only their own notification preference overrides matching `user_id = get_current_user_account_id()`.
- **`get_current_user_role()` Helper Function**: Defined in migration `20260811000001_system_governance_settings.sql` as a `SECURITY DEFINER` function returning `user_account.role::text` for `auth.uid()`, ensuring RLS policies (e.g. `agency_system_setting`) can safely evaluate caller roles without circular dependencies.
- **Supabase CLI DB Push Migrations**: Migrations `20260807000000_seed_master_admin.sql` and `20260807000001_cleanup_manual_admin.sql` provision `pgcrypto` in `extensions` schema and handle archiving master admin accounts cleanly for remote Supabase CLI synchronization.

## 6. Removed: Orphaned/Never-Wired Modules (`20260817000007_remove_orphaned_erp_modules.sql`)

A stale-feature audit found several modules that were scaffolded at the schema level — tables, RLS, and in some cases a RPC — but never had any consumer in `src/`. Verified via exhaustive grep (no `.from(...)`, `.rpc(...)`, or other reference anywhere in the app) and a reverse-FK search (nothing else in the schema depended on them) before removal. Dropped in this migration:

- **WhatsApp Gateway**: `whatsapp_queue` (fed by a real `deal.stage` trigger and a daily cron job, but no dispatch function ever existed — messages queued forever at `status = 'pending'`), its trigger `trg_deal_stage_whatsapp` / `trigger_deal_stage_whatsapp_notification()`, the `queue_tenant_rent_reminders()` cron job, and `whatsapp_message_log` (a second, entirely unwritten table from an earlier abandoned design of the same feature).
- **Tiered commission engine & CDA** (Module 3): `commission_tier_rule`, `calculate_tiered_commission_splits()`, `commission_disbursement_instruction`.
- **Bank reconciliation / GL sync / EFT payouts** (Module 5): `bank_statement_import`, `accounting_sync_log`, `eft_payout_batch`.
- **Property syndication & buyer matching** (Module 2): `portal_syndication_feed`, `buyer_criteria_profile`, `match_buyers_for_mandate()`.
- **CRM drip marketing**: `drip_campaign`, `drip_campaign_step` — no processor ever consumed a campaign step.
- **Smart-form document merge tokens**: `document_field_token` — superseded in practice by the actually-used `generate_document_from_template()`.
- **Inbound portal-lead webhook log**: `portal_lead_webhook_log` — its client handler (`portalWebhookService.ts`) was already deleted in an earlier cleanup; this table is what was left behind.
- **`register_new_agent(text, text, text, text)`**: revoked from every role in `20260729000005_operational_hardening.sql`, never re-granted, no caller. Superseded by the invitation-based registration flow.
- **`is_principal_or_admin()`**: its only caller (a policy on `public.deal`) was dropped by `20260729000005_operational_hardening.sql`, replaced by `can_access_deal()`. Unreachable ever since.

The matching frontend routes (`/admin/whatsapp`, `/admin/franchise`, `/admin/trust`) and `src/services/*` files for the above were removed from `src/` in the same pass. **Not touched**: Section 86 trust accounting (`trust_account_ledger`, `record_trust_transaction()`, `process_monthly_section_86_4_interest_allocation()`) is real, working, PPRA-mandated functionality — only its `/admin/trust` UI page was removed (product decision, not a staleness finding). `src/data/trust.ts` was trimmed rather than deleted: it still exports `useRecordTrustTransaction()`, which `src/components/commission/reconciliation-content.tsx` genuinely consumes (the removed `useTrustLedger()` read hook had no remaining caller). The backend and its monthly cron job are untouched and keep running.

## 7. Agent Seniority Label (`20260817000008_agent_seniority_label.sql`)

`public.user_account.seniority` and `public.user_invitation.seniority` (new `public.agent_seniority` enum: `junior` / `mid_level` / `senior`) back a real, admin-editable experience-tier label — Junior / Mid-level / Senior, chosen for consistency with the frontend's pre-existing (previously fake) `"Senior" | "Mid-level"` values. This is deliberately **not** the same thing as `public.user_role` (a permissions role: admin/agent/admin_agent) or `user_account.is_candidate` (the real PPRA/FICA-regulated "candidate agent under supervision" status) — it's an informal internal label only, with no regulatory or authorization meaning.

Before this migration, seniority was entirely fake: `src/data/operations.ts` computed it as a hardcoded `role === 'admin' ? 'Admin' : 'Senior'`, so every single agent displayed as "Senior" regardless of reality — visible on the FFC compliance register, whose "Role" column was actually rendering this fake seniority value (now relabeled "Seniority" to match its real content).

- `create_user_invitation(text, public.user_role)` gained an optional third `p_seniority public.agent_seniority default 'junior'` parameter. The old two-argument signature was dropped first — Postgres's `CREATE OR REPLACE FUNCTION` cannot change a function's parameter list, only its body.
- `accept_user_invitation(...)` now copies `v_invite.seniority` onto the new `user_account` row (and keeps it in sync on the pre-existing `ON CONFLICT (auth_user_id) DO UPDATE` path for a prior partial registration).
- Set at invite time (Admin > Team Members > Invite) and editable afterward from the same screen's Edit dialog, via a direct `user_account`/`user_invitation` update — no new RLS policy needed, since admins/admin_agent already have update access to both tables.

## 8. Fix: Master Admin Login 500 (`20260817000009_fix_master_admin_null_auth_tokens.sql`)

The seeded master admin (`admin@dreamsupreme.co.za`) could not log in at all: every
attempt returned HTTP 500 `{"code":500,"error_code":"unexpected_failure","msg":"Database
error querying schema"}`. The account was otherwise valid — the password hash, the
`user_account` profile, and the `admin` role were all correct.

**Root cause.** `20260807000000_seed_master_admin.sql` `INSERT`s directly into
`auth.users` and did not supply the token/email-change columns, so they defaulted to
`NULL`. GoTrue is written in Go and scans `confirmation_token`, `recovery_token`,
`email_change`, `email_change_token_new`, `email_change_token_current`, `phone_change`,
`phone_change_token`, and `reauthentication_token` into non-nullable `string` fields;
a `NULL` makes that scan fail. GoTrue reports the failure as a generic
"Database error querying schema" 500 rather than an auth error, which is why the
symptom looked like a schema/permissions problem rather than a bad row.

Accounts created through the normal signup/invitation flow are unaffected, because
GoTrue itself writes `''` (not `NULL`) for "no token pending" — only hand-seeded rows
are broken. A nonexistent-email login correctly returned a 400, which is what isolated
the fault to the seeded row rather than to GoTrue or the anon key.

**Fix.** The migration normalises `NULL` -> `''` on all eight columns (idempotent, and
`''` is exactly what GoTrue writes itself). `20260807000000_seed_master_admin.sql` was
also amended to supply `''` for these columns on insert, so a rebuilt environment does
not reproduce the broken row.

## 9. Security Fix: Invitation Privilege Escalation (`20260817000010`) and Master Admin Reactivation (`20260817000011`)

Two linked issues found during an authorized penetration test.

**Privilege escalation via `create_user_invitation`.** The authorization guard was
`if v_user_account_id is not null and v_role not in ('admin','admin_agent') then raise …`.
It only rejected callers that *had* an account, so an unauthenticated caller — anyone
holding the public anon key that ships in the browser bundle — passed straight through
(their `get_current_user_account_id()` is NULL). This let an anonymous attacker mint a
valid `admin` invitation token and provision a full admin account through the public
`/register` flow. Verified exploitable against the live project, then fixed: the function
now requires an authenticated `admin`/`admin_agent` to invite, with a single narrow
exception for genuine first-run bootstrap (zero `user_account` rows).

**Master admin left archived.** `20260807000000_seed_master_admin.sql` creates
`admin@dreamsupreme.co.za` as `active`, but `20260807000001_cleanup_manual_admin.sql`
then archived it. Since `get_current_user_account_id()` and `get_current_role()` filter
on `status = 'active'`, the database returned NULL for the master admin session — it was
never recognized as an admin server-side. The app's admin behaviour therefore only
functioned through insecure side doors (the hardcoded client-side password bypass in
`login.tsx` and the anonymous invitation path above), and the normal login flow bounced
back to `/login`. `20260817000011` restores the account to `active`, which is what the
seed intended and what server-side authorization requires.

Both fixes were verified: an authenticated admin can still create invitations, an
anonymous caller is rejected with "Only managers can invite users", and the master admin
session now resolves `get_current_role() = 'admin'`.

## 10. Storage Edge Function: `isPublic` Authorization Bypass (r2-storage)

Not a database migration, but part of the same pentest and recorded here for completeness.
The `r2-storage` Supabase Edge Function trusted a client-supplied `isPublic` flag (and a
`public/` key prefix) and returned `{ ok: true }` before any authentication check. Anyone
with the public anon key could therefore read, overwrite, or delete **every** object in
the `dream-supreme-documents` bucket (FICA IDs, FFC certificates, deal contracts, avatars)
across all agencies by sending `isPublic: true`. Verified by exfiltrating a real private
document with no user session. Fixed by removing the `isPublic`/`public/` bypass entirely
— authorization is now decided solely from the authenticated session and the requested
key — and by adding key hardening that rejects path-traversal shapes (`..`, empty
segments, leading slash).

## 11. Security Fix: NULL-role Guard Bypass in Admin RPCs (`20260817000012`)

Also found during the authorized pentest. The `admin_*` SECURITY DEFINER functions
guarded themselves with `if not (get_current_role() in ('admin','admin_agent') and …)`
or `if get_current_role() not in ('admin','admin_agent')`. For an unauthenticated caller
`get_current_role()` is NULL, and in Postgres three-valued logic `NULL in (…)` /
`NULL not in (…)` evaluate to NULL, so `IF NULL THEN raise` never fired — the privileged
body ran as the definer. Confirmed live: an anonymous caller reached
`admin_empty_recycle_bin` and it executed rather than rejecting. Affected functions
permanently purge the recycle bin, archive deals, suspend/retire users, and reset
commissions.

Fixed in two independent layers on all five functions (`admin_archive_old_deals`,
`admin_deactivate_idle_agents`, `admin_empty_recycle_bin`, `admin_bulk_reset_commission`,
`admin_bulk_retire_users`): (1) the guard is rewritten NULL-safe — `coalesce(role::text,'')
not in (…)` is TRUE for a NULL role and agency scoping uses `is distinct from`, so a NULL
role always raises; (2) EXECUTE is revoked from `anon`/`public` and granted only to
`authenticated`. Verified: anon now receives `permission denied` (42501), the NULL-role
guard raises, and an authenticated admin still succeeds.

Note the same `get_current_role() not in (…)` guard shape exists in several functions that
are NOT granted to `anon` (e.g. the `popia_*` PII export/erase functions, `upsert_ffc_certificate`,
`save_commission_rule_set`, `transition_deal`). They are not currently reachable
unauthenticated, but the guard shape is latently NULL-unsafe and should be migrated to the
`coalesce(role::text,'')` form as defense-in-depth.

## 12. Security Fix: Quota Tampering & Cron Function Exposure (`20260817000013`)

Final cluster from the pentest.

- `update_user_storage_quota(target_user_id, new_limit_bytes)` used the same NULL-unsafe
  `caller_role not in ('admin','admin_agent')` guard. Verified live: an anonymous caller
  changed the master admin's `storage_limit_bytes` from 1 GB to 777 GB. Fixed with a
  NULL-safe `coalesce(caller_role::text,'')` guard and EXECUTE revoked from anon/public
  (granted to authenticated).
- `process_monthly_section_86_4_interest_allocation(p_agency_id, p_period_date)` and
  `generate_daily_notification_digests()` had no authorization check at all. They are
  pg_cron-only ('monthly-trust-interest-allocation', 'generate_daily_notification_digests')
  but were also anon-callable, so anyone could trigger a trust-interest allocation run or a
  notification-digest sweep. EXECUTE revoked from anon/public; pg_cron runs them as the job
  owner, so the scheduled runs are unaffected (both jobs confirmed still active).

## 13. Property24 Agent Sync (`20260818000005_property24_agent_sync.sql`)

Lets an admin paste an agent's **public** Property24 estate-agent profile URL when inviting them, so that agent's photo, bio, areas serviced and live sale/rental listings appear on their own profile page once they register.

The URL is carried invitation → account using exactly the pattern established by seniority in §7:

- `public.user_invitation.property24_url` and `public.user_account.property24_url` (both `text`, nullable), each guarded by a `CHECK` constraint matching `^https://(www\.)?property24\.com/estate-agents/[^/]+/[^/]+/\d+$`. This is a data-hygiene guard, not a security boundary — the Worker re-validates before fetching.
- `create_user_invitation` gained an optional fourth `p_property24_url text default null` parameter (the prior three-argument signature was dropped first, since `CREATE OR REPLACE FUNCTION` cannot change a parameter list). It re-checks the URL shape and raises on a malformed value. Because the new parameter has a default, existing three-argument callers still resolve.
- `accept_user_invitation(...)` copies `v_invite.property24_url` onto the new `user_account` row, and on the `ON CONFLICT (auth_user_id) DO UPDATE` path uses `coalesce(excluded.property24_url, public.user_account.property24_url)` so a re-run never blanks an existing value.

Cached results live on `user_account` (`property24_profile jsonb`, `property24_synced_at timestamptz`, `property24_sync_error text`) and in a new table:

- `public.agent_property24_listing` — one row per listing per agent, keyed by a unique index on `(user_account_id, listing_number)`. Purpose is deliberately **not** part of that key: Property24 can surface the same listing under both the sale and rental feeds for dual-mandate stock, so the later feed updates the row rather than duplicating it. `first_seen_at` is preserved across upserts; `last_seen_at` is stamped each run and anything older than the current run is pruned, so stock that has come off Property24 (sold, let, withdrawn) disappears from the profile.
- RLS: a single `select` policy, `"Agency members view Property24 listings"`, scoped by `agency_id = public.get_current_agency_id()`. There is deliberately **no** insert/update/delete policy for `authenticated` — all writes come from the service role inside the sync Worker, so nothing in the browser can forge listings. `grant select` to `authenticated`, `grant all` to `service_role`.

### Where the sync runs, and why

Fetching happens in a standalone **Cloudflare Worker** (`workers/property24-sync/`), not in a Supabase Edge Function and not in the app:

- Property24 answers Supabase's egress with its own branded "Server unavailable" **HTTP 503** page (verified: no `cf-ray`/`server` header, so not a Cloudflare bot wall — Property24 itself declining cloud traffic). Cloudflare Workers are served normally.
- The app deploys as a **static SPA** (`vite build` → `dist/` → nginx/Vercel), so it has no server runtime that could host this. Note this also means TanStack Start `server.handlers` route blocks — including the pre-existing `src/routes/sitemap[.]xml.ts` — never execute in production.

The browser calls the Worker with the signed-in user's Supabase access token; the Worker verifies it via the publishable key (so Supabase Auth validates it rather than the Worker trusting the request), then authorizes: an agent may sync themselves, an admin may sync anyone **whose `agency_id` matches the caller's**. The `SUPABASE_SECRET_KEY` never leaves the Worker. A nightly cron (`0 2 * * *` UTC = 04:00 SAST) refreshes the least-recently-synced active agents in batches, since cheerio parsing consumes the Worker's bounded CPU budget.

Nothing in this path logs in, solves CAPTCHAs, or retries past a refusal: a 401/403 aborts immediately, and a repeated 503 is reported as Property24 declining the request rather than worked around.

## 14. Reconciling Live Database Drift (`20260818000006_reconcile_live_drift.sql`)

`supabase db diff --linked --schema public` reported **19 functions that existed only in the production database and in no migration**. They had been applied directly to the database at some point rather than through the migration flow, which meant `supabase db reset` did not reproduce production and any fresh environment silently differed from it.

This was not cosmetic. The live copies are the **more hardened** ones, and several are authorization logic:

`is_manager`, `can_access_deal`, `can_edit_lease`, `protect_user_account_sensitive_fields`, `prevent_hard_delete`, `create_deal`, `create_client`, `create_mandate`, `assign_lead_round_robin`, `bootstrap_principal`, `notify_agency_admins`, `record_trust_transaction`, `review_compliance_item`, `run_daily_sweeps`, `upsert_ffc_certificate`, `process_monthly_section_86_4_interest_allocation`, `popia_lookup_party`, `popia_export_party_data`, `popia_erase_party_data`.

Two concrete examples of the divergence:

- Live `protect_user_account_sensitive_fields` additionally honours `current_setting('role')` for `service_role`/`postgres`/`supabase_admin` and defers to `public.is_manager()`; the migration copy in `20260730000000` has neither.
- Live `prevent_hard_delete` raises **unconditionally**. The copy in `20260729000005` still has an `app.workflow_change = 'allowed'` escape hatch, so the repo described a materially weaker guard than production enforced.

The danger was directional: because the repo held the *older, weaker* definitions, any future `CREATE OR REPLACE` written against them would have silently reverted a production security fix without anyone noticing.

`20260818000006` therefore captures **production as the source of truth**. It is a no-op against the live database — every statement restates what is already there — and exists so a fresh environment matches production. The ~530 `revoke`/`grant` statements the diff also emitted were deliberately omitted: each was a `revoke all …` immediately followed by a `grant` of the same privileges, i.e. a restatement of current state rather than a change. The 15 `alter default privileges … revoke all` statements **were** kept, since those genuinely control whether newly created objects are auto-exposed to the API roles.

### Preventing recurrence

`scripts/check-schema-drift.mjs` (`npm run check:drift`) runs `supabase db diff --linked`, filters the privilege restatement noise described above, and exits non-zero when anything else remains — naming the offending objects. It runs in CI (`.github/workflows/ci.yml`, `database_checks` job) on `main`, and skips with a warning when `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_ID` are unset so that forks and outside PRs are not blocked by a missing secret.

It has been verified in both directions: it passes against the reconciled database, and exits 1 identifying the function when an object present only in the database is introduced.

**The rule this encodes:** never apply schema changes straight to the database. If it has already happened, capture it with `npx supabase db diff --linked -f <describe_the_change>` and review the result — production is usually the more-hardened side, so the migration should adopt production rather than overwrite it.

## 15. Clearing Property24 Data on Unlink (`20260818000007_clear_property24_data_on_unlink.sql`)

Removing an agent's `user_account.property24_url` — by clearing the field in Admin > Team Members, or via **Remove** on the Property24 card in Settings > Profile — previously left `property24_profile`, `property24_synced_at` and every row in `agent_property24_listing` behind. An unlinked agent's stock therefore kept appearing on the Listings and admin Property Portfolio pages indefinitely.

The cleanup deliberately runs in the database rather than the client:

- `agent_property24_listing` carries a **select-only** policy for `authenticated` (see §13). Only the sync Worker's service role writes listings. Adding a delete policy so the browser could clean up would let any authenticated user delete listing rows directly, which is a worse trade than a trigger.
- A trigger also cannot be forgotten by some future code path that clears the URL another way — a bulk update, an admin RPC, or a support fix applied by hand.

`clear_property24_data_on_unlink()` is `security definer` and fires `before update of property24_url on public.user_account`, guarded so it only acts on the actual transition from a set URL to NULL rather than on every profile save. Because it is a BEFORE trigger it clears the three cached columns on `NEW` directly, so the whole unlink is a single write.

Verified against the live database: with a linked agent holding 33 synced listings, setting `property24_url` to NULL left `property24_profile` NULL, `property24_synced_at` NULL and zero listing rows.

## 16. Commission Is Administrator-Only (`20260818000008_admin_only_commission.sql`)

An audit of the commission system found that agents could set the number that drives the money, and that two administrator guards did not fail closed.

### The material finding: a mandate's rate overrides the rule set

`calculate_deal_commission` computes gross commission as:

```
sale_price_cents * coalesce(nullif(mandate.commission_rate_bps, 0),
                            rule_set.default_commission_rate_bps) / 10000
```

The mandate's own rate therefore **takes precedence over the administrator's commission rule set**, and agents could set it freely by three routes:

- the mandate INSERT policy (`Agency users can create mandates`) checks only `agency_id = get_current_agency_id()`;
- `create_mandate(p_payload)` reads `commissionRateBps` straight from the client payload with no role check on that field;
- the mandate UPDATE policy (`Managers can update mandates`) admits, besides administrators, *any agent who can access a linked deal* — and its WITH CHECK validates only the agency, not which columns changed.

An agent could therefore raise the commission rate on their own deals and bypass the configured rule set entirely.

This is fixed with a trigger, `enforce_admin_only_commission_rate`, rather than by rewriting `create_mandate`, so the rule holds for **every** write path — the RPC, a direct PostgREST insert, a future bulk import — instead of only the one function:

- on INSERT by a non-administrator, `commission_rate_bps` is overwritten with the agency's default rule-set rate (falling back to 500 bps), so a client-supplied rate is ignored rather than trusted;
- on UPDATE by a non-administrator, any change to `commission_rate_bps` raises.

It uses `public.is_manager()`, which is `exists()`-based and so returns false — never NULL — for a caller with no active account, and honours the existing `app.admin_override` escape used elsewhere for administrative scripts.

### Guard hardening

Both `save_commission_rule_set` and `calculate_deal_commission` guarded with:

```sql
if public.get_current_role() not in ('admin', 'admin_agent') then raise exception ...
```

`get_current_role()` returns NULL for any caller without an **active** `user_account` — a suspended agent whose JWT has not yet expired, or somebody who completed `supabase.auth.signUp` but never accepted an invitation. `NULL not in (...)` evaluates to NULL rather than true, so the guard fell through instead of raising.

Neither was exploitable in practice at the time of the audit: `save_commission_rule_set` then hit a NOT NULL `agency_id`, and `calculate_deal_commission` then failed `can_access_deal`. Both are fixed regardless — each was one schema change away from becoming real, and a line that reads as an authorization check should behave like one. This is the same defect class as `20260817000012`.

### Frontend

The commission inputs in the deal capture form (`src/routes/deals/new.tsx`) and the quick capture modal (`src/components/deal/quick-deal-modal.tsx`) are now read-only for non-administrators, so the form matches what the database will actually save. The Commission Rules screen itself was already administrator-only, being under the `canAccessAdmin`-guarded `/admin` route.

Verified against the live database: a non-administrator update of `mandate.commission_rate_bps` leaves the value unchanged, while an administrator can still change it (500 → 750 → 500 via PostgREST).

## 17. Compliance Visibility in the Agent Portal (`20260818000009_scope_ffc_visibility.sql`)

The agent portal's Compliance section showed every practitioner in the agency — names, PPRA references, FFC numbers and expiry dates — to any signed-in agent.

### The FFC leak was in RLS, not the UI

`ffc_certificate` carried **two permissive SELECT policies**:

| Policy | Effect |
|---|---|
| `Agency FFCs are readable` | any agency member — **no role check** |
| `Users view own or agency FFCs` | own record, or an administrator's agency-wide view |

Postgres ORs permissive policies together, so the broad one governed and the stricter one was dead weight. Every agent could read every colleague's certificate regardless of the second policy's intent. The broad policy is dropped; the stricter one is left to govern.

Administrators keep the agency-wide register through the surviving policy, which is what Admin > Compliance renders. Nothing else needed the broad policy: the FFC checks inside `calculate_deal_commission` run in `SECURITY DEFINER` functions and bypass RLS entirely.

### The rest is presentation, deliberately

The practitioner name and PPRA reference come from `user_account`, whose SELECT policy (`Users can view own account or their agency's directory`) is intentionally agency-wide — agent pickers, deal participant lists and the team directory all depend on it. Narrowing it to fix a compliance screen would break those. The FFC register therefore filters to the signed-in user in the client for non-administrators, while the certificate data itself is protected in the database.

The other two tabs are administrator-only:

- **Audit Log** — `audit_log`'s SELECT policy already admitted administrators only, so an agent reached the page and saw a permanently empty table with no explanation. The tab is now hidden and the route redirects.
- **POPIA Requests** — exporting and erasing a data subject's records across the agency is an administrator responsibility.

**FICA Register is unchanged**: it reads `deal_party`, whose policy is `can_access_deal(deal_id)`, so an agent already saw only parties on deals they are on. That is client data scoped by deal access, not colleague data.

Both route guards live in small wrapper components rather than inside the page components. Placing an early return above a component's own `useState`/`useMemo` calls violates the rules of hooks — ESLint caught 16 such errors on the first attempt.

## 18. NULL-Role Guard Regression Was Still Live (`20260819140000`–`20260819140200`)

CI's schema-drift check (`Check live schema matches migrations`, added for the incident described in `20260818000006`) had been failing on every push since 2026-08-18. Reconciling that drift — replaying it with `supabase db diff --linked` — surfaced a second, independent problem: production's `calculate_deal_commission(uuid, uuid)`, the two-argument overload directly granted to `authenticated` and callable as a PostgREST RPC, still had the *unguarded* form from before `20260818000008`.

### Why the earlier fix didn't take

`20260818000008` added a `p_override boolean default false` parameter to `calculate_deal_commission` and rewrote the guard to `coalesce(public.get_current_role()::text, '') not in (...)`. But `create or replace function` with a different argument list creates a **new overload** rather than replacing the existing one — Postgres resolves by signature, not by name. The two-argument function every other write path calls was left behind untouched, still carrying the pre-fix guard, alongside the new three-argument function that only the internal `transition_deal` → `calculate_deal_commission(id, null, p_override)` call path reaches.

### The same defect class was live in four more functions

Querying the live database for every function still matching the raw (uncoalesced) form turned up:

- `transition_deal`'s own override guard — `p_override and public.get_current_role() not in (...)`, which is NULL (not true) when the role is NULL, so a caller in that state could pass `p_override = true` and skip stage-gate validation entirely;
- `popia_lookup_party`, `popia_export_party_data`, `popia_erase_party_data` — all three POPIA subject-data RPCs;
- `upsert_ffc_certificate`.

None of these had ever been touched by a coalesce fix; they simply carried the same pattern the `20260817000012`/`20260818000008` fixes were written to eliminate, undetected because nothing was diffing the live database against the migration history until the CI check above existed — and that check itself only started failing loudly once this migration set tried to capture the drift.

All five are now fixed with the same one-line change: `public.get_current_role()` → `coalesce(public.get_current_role()::text, '')` in the guard, signature and rest of the body unchanged. Verified against the live database that no function under `public` still matches the raw pattern.

### CI itself was also broken

Independently, the root Vitest run had been failing every push because it picked up `workers/property24-sync`'s tests without that package's own dependencies (`cheerio`, etc.) installed — it's a separate npm package with its own `package.json` and test script, never actually exercised in CI. `vite.config.ts` now excludes `workers/**` from the root run, and a dedicated CI job installs and runs that package's own 23 tests.

## 19. Missing `'archived'` Value on `commission_calc_status` (`20260819160000`)

Every version of `calculate_deal_commission` since `20260731000000_cascading_commissions.sql` has superseded a deal's prior provisional commission calculation with:

```sql
update public.commission_calculation set status = 'archived' where deal_id = p_deal_id and status = 'provisional';
```

but `commission_calc_status` was only ever defined as `('provisional', 'confirmed', 'reversed')` — `'archived'` was never a member of the enum. Any deal being recalculated — re-advancing to `registered` after an earlier provisional calculation already existed for it — hit `invalid input value for enum commission_calc_status: "archived"` and the entire stage transition failed, surfaced to the agent as a generic "Stage Gate Requirement Pending" error with no indication the root cause was a schema defect rather than an unmet requirement.

Fixed additively with `alter type public.commission_calc_status add value 'archived'`, which requires no data rewrite and does not affect any existing row.

## 20. `calculate_deal_commission` Read a Column That Doesn't Exist (`20260819161000`)

Immediately after fixing §19, the same "Advance to Registered" action failed again with `record "v_participant" has no field "external_payee_name"`. `public.deal_participant` has no `external_payee_name` column — it's `external_agency_name`. `calculate_deal_commission`'s participant loop was reading the wrong field name when populating `commission_allocation.external_payee_name` (which *is* the correct column name on the destination table; only the source read on `deal_participant` was wrong). This broke commission calculation for every deal, not just ones with external participants, since `%rowtype` field access is resolved at parse/plan time regardless of the row's actual `is_external` value.

Fixed in both `calculate_deal_commission` overloads by reading `v_participant.external_agency_name` instead. While investigating, every other table/column reference in the function was cross-checked against the live schema (`commission_calculation`, `commission_rule_line`, `commission_advance`, `deal`, `mandate`, `branch`, `commission_rule_set`) and confirmed correct — this was an isolated mismatch, not a wider pattern.

## 21. Root Cause of the Persistent CI Drift Check Failure: CRLF in Stored Function Bodies (`20260819170000`, `20260819170100`)

The "Check live schema matches migrations" CI job (§18) had never once passed since it was introduced — always the same 54 statements across 8 named functions (`cancel_deal`, `create_status_request`, `enforce_deal_workflow`, `get_current_role`, `log_audit_event`, `set_bond_status`, `set_condition_status`, `touch_updated_at`), regardless of what else changed in a given push. Running `supabase db diff --linked` locally never reproduced it, which pointed at something environment-specific rather than a real schema difference.

It was real, just not a schema difference: `pg_get_functiondef()` on these 8 functions showed literal `\r\n` (CRLF) byte sequences embedded in the stored function body — `chr(13) || chr(10)` inside `prosrc`, confirmed with `prosrc like '%' || chr(13) || '%'`. At some point these 8 were applied directly to production from a Windows checkout (this repo's local git config uses `core.autocrlf=true`), and Postgres stored exactly the bytes it was sent, CRLF included. A migration replay on the Linux CI runner produces LF-only bodies for the identical logic, so the diff tool was correctly reporting a genuine byte-level mismatch on every run — it was never a false positive, just a cosmetic one that nonetheless failed a byte-for-byte comparison. It didn't reproduce locally because the local shadow database (built from the same on-disk migration files, subject to the same OS/git line-ending handling) ended up with the same line endings as what was live.

Fixed by re-declaring all 8 functions with identical logic, sourced directly from `pg_get_functiondef()` output and written with LF-only line endings (verified with a byte-level check before pushing: zero `\r` bytes in the migration file). Verified against the live database afterward that no function under `public` still contains an embedded `\r`, and that `supabase db diff --linked` reports zero drift.

## 22. Deal Pipeline Consolidated from 13 Stages to 7 (`20260819180000`, `20260819180100`)

The `deal_stage` pipeline had 13 stages, but only 5 ever had a stage-gate check in `transition_deal`, and several were never independent decision points an agent acted on — they were parallel conveyancer admin (compliance certs, transfer duty & VAT, rates & levy clearance, documents & guarantees) or pre-contract housekeeping (mandate signed, listed/marketing, offer received) that got flattened into one sequential list.

Consolidated to 7, losing no legal or financial gate:

| New stage | Replaces |
|---|---|
| Listing & Negotiation | Mandate Signed, Listed/Marketing, Offer Received |
| OTP Signed | *(unchanged)* |
| Conditions Pending | *(unchanged)* |
| Conveyancing | Conveyancer Instructed, Compliance Certs, Transfer Duty, Rates & Levy Clearance, Documents & Guarantees |
| Lodged | *(unchanged)* |
| Registered | *(unchanged)* |
| Commission Released | *(unchanged)* |

**Enum change is two migrations, not one.** `ALTER TYPE ... ADD VALUE` cannot be used in the same transaction as a statement that references the new value, so `20260819180000` only adds `listing_negotiation` and `conveyancing` to `public.deal_stage`; `20260819180100` (a separate migration, separate transaction) does everything that uses them — backfilling existing `deal.stage` rows, moving the column default, and rewriting `transition_deal` and `submit_conveyancer_status`.

**Gate logic was merged, not dropped.** Advancing past "Listing & Negotiation" now requires both a signed mandate with an expiry date *and* at least one captured offer — the union of the old `mandate_signed` and `offer_received` checks. Advancing past "Conveyancing" still requires an appointed conveyancer — the old `conveyancer_instructed` check, now gating the whole consolidated phase instead of just its first step.

**History is not rewritten.** The 8 superseded enum values (`mandate_signed`, `listed_marketing`, `offer_received`, `conveyancer_instructed`, `compliance_certificates`, `transfer_duty_vat`, `rates_levy_clearance`, `documents_signed_guarantees`) stay valid enum members — Postgres cannot cheaply drop them — but are never written to `deal.stage` again. Existing `deal_stage_history` rows keep whatever stage was actually current at the time, which is the accurate record. `src/lib/domain.ts`'s `stageFromDb` maps all 8 legacy values onto their new consolidated label so old history still renders a sensible name instead of `undefined`.

**Two pre-existing bugs surfaced and fixed while touching this code**, unrelated to the consolidation itself but found because they used the same stage values:
- `src/components/admin/admin-deals-pipeline.tsx` compared `usePipelineDeals()`'s raw db-value stage (e.g. `"otp_signed"`) against UI labels (e.g. `"OTP Signed"`) — the comparison could never match, so its progress stepper always showed step 1 and its active/closed filter always treated every deal as active. Fixed by mapping through `stageFromDb` once per deal.
- `src/data/deals.ts`'s agent-earnings query checked `d.stage === "commission_paid"`, which was never a valid `deal_stage` value (should have been `commission_released`) — a deal that reached Commission Released was silently excluded from YTD earnings. Fixed to check the real value.

## 23. In-App Notifications Never Pushed Live (`20260820000000`)

The header bell (`src/components/layout/header.tsx`) subscribes to a Supabase Realtime `postgres_changes` INSERT listener on `public.notification` to toast new notifications and bump the unread badge without a reload. `.subscribe()` always resolves successfully even for a table that was never added to the `supabase_realtime` publication — Postgres just never emits change events for it, so the client sits subscribed and silent. Checked the live publication directly (`select * from pg_publication_tables where pubname = 'supabase_realtime'`): it had zero tables in it. No migration had ever added one.

RLS was already correct (`Users can view their own notifications`, scoped to `user_account_id`), so this wasn't a permissions problem — Postgres simply never told Realtime a row had been inserted. The header's one-time `useQuery` fetch on mount still worked, so notifications *did* eventually appear, just only after a manual reload — exactly the intermittent "don't always work" symptom, since anything that arrived while already on the page never showed up until the next navigation.

Fixed with `alter publication supabase_realtime add table public.notification`. `header.tsx` is the only place in the codebase using `postgres_changes`, so this was the complete fix rather than one of several affected listeners.

## 24. Admin Notification Coverage Audit (`20260820001000`)

Audited every place the platform writes to `public.notification`, to find real gaps in what admins get notified about rather than guess:

- **`notify_agency_admins()`** (trigger on `deal` insert/stage/status, and on `audit_log` for `progress_note_added`) — deal registered, deal cancelled, deal stage advanced (generic), progress notes.
- **`run_daily_sweeps()`** — already comprehensive: suspensive condition deadlines (14/7/3/1 days out, and overdue), mandate expiry (30/14/7/3/1 days out, and expired), and FFC certificate expiry (60/30/14/7/3/1 days out, and expired) — admins get notified about *every* agent's FFC, not just their own.
- **`submit_conveyancer_status()`** — notifies deal participants when a conveyancer confirms lodgement.
- **`process_monthly_section_86_4_interest_allocation()`** — trust interest processing.

The one real gap: `trg_notify_deal_events` fires `after insert or update of stage, status`, so it runs on every new deal too, but `notify_agency_admins()`'s branches only ever matched an *update* — `registered`/`cancelled` can't be true on a brand-new deal, and the generic stage-change branch explicitly required `OLD is not null`. A freshly created deal fell through to `else return NEW`, so admins got nothing when a deal was opened. Added a `OLD is null` branch ("🆕 New Deal Opened") ahead of the others; the existing branches are unchanged (only their `OLD is null or ...` guards were dropped, since the new branch above them now handles that case).

**Second problem while auditing the admin experience:** the admin portal (`src/components/admin/admin-header.tsx`) had no notification UI at all — it imported `Bell` from `lucide-react` and never rendered it. Every fix above was invisible to admins regardless. Extracted the agent portal's bell/popover/realtime logic into a shared `NotificationBell` component (`src/components/layout/notification-bell.tsx`, taking the account id as a prop) and wired it into both headers.

## 25. Per-User Storage Quota Drifted From Reality (`20260820002000`)

`user_account.storage_used_bytes` only ever went up for profile photos: replacing or removing one deletes the old R2 object (`removeStoredFile`) but the byte count was never decremented for it, only incremented for the new upload. Confirmed on production: Master Admin had `storage_used_bytes = 80` with `avatar_key = null` and zero `document` rows — bytes from a test avatar that were never released once it was replaced or removed.

Root cause: there was nowhere to read the *previous* avatar's size from at the point of replacing/removing it, since only the current R2 key was persisted, never its byte size. Added `user_account.avatar_size_bytes`, set alongside `avatar_key` on every avatar write (`profile-photo.tsx`, `register.tsx`), and used to correctly net the delta on replace (`new size - old size`) and remove (`-old size`) instead of only ever adding.

One-time reconciliation to ground truth in the same migration: every account had `avatar_key = null` on production at the time, so the correct `storage_used_bytes` was exactly the sum of `document.size_bytes` actually attributed to that user (`uploaded_by`) — no avatar contribution to account for. Fixed Master Admin's phantom 80 bytes; left the one account with real uploaded documents unchanged (its stored total already matched the sum exactly).

**Separately found while auditing every `uploadFileToR2` call site:** `src/routes/admin/agency.tsx`'s agency-logo upload never called `recordStorageUsageDelta` at all — that upload was completely invisible to the quota system, an undercount rather than an overcount. Fixed by charging it against the uploading admin's account, consistent with how other admin-driven uploads on behalf of the agency work.

## 26. Deal Notifications Never Reached the Agent Who Owned the Deal (`20260821001000`–`20260821004000`)

`notify_agency_admins()` (despite the name — it's the single trigger function for all deal-lifecycle notifications) only ever inserted rows for `role in ('admin', 'admin_agent')`. An agent working a deal got zero in-app or email notifications about their own new deals, registrations, cancellations, stage changes, or progress notes; only the admins overseeing the agency ever saw them. `run_daily_sweeps()`'s condition/mandate reminders already handled this correctly (admins get every deal, agents only their own via `deal_participant`), so it served as the reference pattern.

Fixed by adding a second recipient branch — the deal's internal (`deal_participant.is_external = false`) agents — unioned with the existing admin branch, deduped by account id in case an admin happens to also be a participant. `submit_conveyancer_status()` had the mirror-image gap (only notified participants, so an admin not on the deal missed conveyancer lodgement updates) and was fixed the same way.

**Trigger timing pitfall:** `create_deal()` inserts the `deal` row, then inserts its `deal_participant` row afterwards in the same function/transaction. The existing `trg_notify_deal_events` was a plain `AFTER INSERT ... FOR EACH ROW` trigger, which fires immediately on the deal insert — before that later `deal_participant` insert has run. The new agent recipient lookup would have silently found nothing on "New Deal Opened" specifically (every later event — stage change, registration, progress note — happens well after the participant row exists, so those were unaffected). Fixed by recreating it as `CREATE CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, which defers execution to commit time without changing the `OLD`/`NEW` values it fires with.

**Follow-up UX gap:** once admins started receiving every agent's deal notifications, there was no way to tell whose deal a given notification was about. Both `notify_agency_admins()` and the condition/mandate branches of `run_daily_sweeps()` now append `— Agent: <name(s)>` to the notification body, but only for admin/admin_agent recipients — an agent reading a notification about their own deal doesn't need to be told it's theirs. The FFC-expiry sweep already named the agent in its body (`u.full_name || ': FFC ...'`) since it's inherently about one specific person, so it was left unchanged.

**New RLS policy:** users could view and mark-read their own notifications but never delete them — the notification bell's new per-item and clear-all actions needed a `DELETE` policy. Added `"Users delete own notifications"`, scoped to `user_account_id = get_current_user_account_id()`, matching the existing read/update policies.

## 27. PDF Template Designer, and an Existing Dead Template System Found While Building It (`20260821010000`)

Added [pdfme](https://pdfme.com) (MIT-licensed TypeScript/React drag-and-drop PDF designer) as an admin-only visual template builder, one designer per document type: `src/routes/admin/pdf-templates/` lists every document type from `src/lib/pdf-document-types.ts` (deal/compliance documents and the four existing report types), each opening its own `src/routes/admin/pdf-templates/$documentType.tsx` editor. Templates persist to the new `pdf_template` table (`agency_id, document_type` unique), gated entirely by RLS (`get_current_role() in ('admin','admin_agent')` for writes) rather than a client-side check — the same pattern used everywhere else in this codebase, so a non-admin hitting the route directly still can't write a template even if the `/admin/*` layout guard were somehow bypassed. This ships the template *authoring* half only: nothing yet calls `@pdfme/generator`'s `generate()` to merge real deal data into a saved template and produce a downloadable PDF.

**Found while scoping this:** the codebase already has a `document_template` table and a `generate_document_from_template()` RPC (from `20260801000000_trust_accounting_and_templates.sql`) that looks like the same feature — markdown body with `{{merge_field}}` placeholders, merged with deal/lease data. Two things wrong with it, neither touched here since they're a separate, unrelated system from the new `pdf_template` designer:
- **No admin authoring UI exists for it.** `src/data/templates.ts`'s `useDocumentTemplates()` only ever reads; grepping the whole `src/` tree for `document_template` outside that one file turns up nothing that inserts or updates a row. Whatever templates exist can only have gotten there via a migration seed or direct SQL — there's no in-app way to create one.
- **The RPC never writes the file it claims to generate.** `generate_document_from_template()` computes `v_merged_content` (the merged markdown) but never uploads it anywhere — it only inserts a `document` row pointing at a `storage_key` in R2 that nothing ever wrote to. Calling it "succeeds" (returns a document id) and produces a document list entry that 404s the moment anyone tries to actually open or download it.

The dead `document_template` system was dropped outright (`20260821011000_remove_dead_markdown_document_templates.sql`) rather than fixed, since the new pdfme designer replaces it. An equivalent email template designer (EmailBuilder.js, same authoring pattern) followed at `20260821020000_email_template_designer.sql` for the three real transactional email types.

## 28. Wiring Both Template Systems to Real Sends, and an RLS Gap That Made the First Attempt Silently No-Op (`20260821030000`–`20260821031000`)

`pdf_template` and `email_template` (§27) shipped as authoring-only: nothing merged real data into a saved template and actually generated a PDF or sent an email. `pdf-generate.ts` closed the PDF half. The email half was harder — `deal_notification` and `daily_notification_digest` were built from hardcoded HTML string-concatenated directly in `notify_agency_admins()` and `generate_daily_notification_digests()`, completely ignoring whatever an admin designed and saved. Postgres can't render the EmailBuilder.js document schema (that's a React server-render step), so instead of building HTML in SQL, both functions now queue structured `email_type` + `merge_values` on `email_queue` (two new nullable columns, `body_html` relaxed to nullable with a `body_html is not null or email_type is not null` check), and `send-queued-emails` (the Deno dispatch Edge Function) looks up the agency's saved template for that type, merges the values in, and renders final HTML immediately before SMTP send — falling back to the row's plain `subject`/`body_html` if there's no `email_type` or if template rendering itself throws, so a broken custom template never blocks delivery outright. The team-invitation flow (`src/routes/admin/users.tsx`) was rewired the same way, replacing a fake `email_queue` row (marked `"sent"` even though nothing ever dispatched it) and a redundant `supabase.auth.signInWithOtp()` call that sent a second, differently-worded email through Supabase Auth's own mailer — registration only ever used this app's own token, never Supabase Auth's, so that call was pure noise.

**Real bug found while verifying this actually worked:** `email_queue` has had RLS enabled with only a `SELECT` policy since it was created (`20260730000004_phase3d_notifications.sql`) — no `INSERT` policy ever existed. Every server-side producer runs inside a `security definer` function whose owner bypasses RLS, so those inserts always worked silently. But the invitation flow inserts into `email_queue` directly from the browser client as the `authenticated` role, which RLS does *not* bypass, and `supabase-js`'s `.insert()` doesn't throw on a policy rejection — it just returns `{ error }`, which neither the original code nor the first pass at rewiring it checked. Every invitation-email queue insert had been silently rejected by RLS the entire time the invitation flow existed; the UI reported success regardless. Fixed with a `"Admins queue agency emails"` INSERT policy (`agency_id = get_current_agency_id() and role in ('admin','admin_agent')`, mirroring `pdf_template`/`email_template`'s own write policy) and by actually checking the insert's `error` in `users.tsx`, surfacing a `toast.warning` instead of a false success when queueing fails.

## 29. POPIA Erasure Had No Retention-Floor Check (`20260821040000`)

`popia_erase_party_data` could redact a party's identity fields immediately — including before FICA's 5-year retention window (§3 of `COMPLIANCE.md`, running from the date the business relationship terminated or the transaction concluded) had elapsed, and even while the party was still on an active deal or lease. Flagged as an open gap in the 2026-08-19 legal/compliance audit. Fixed by blocking erasure outright while any linked `deal_party`/`lease` row is `status = 'active'`, and otherwise computing the most recent concluded deal/lease date across every relationship the party has ever had (`greatest()` over `deal.registration_date`/`cancelled_on`/`updated_at` and `lease.end_on`) and refusing to erase until 5 years past that date, raising an exception naming the exact eligible date. A party who never actually transacted has nothing to retain against, so they can still be erased immediately.

## 30. Supabase Advisor Triage: Two Cross-Tenant RLS Gaps, One Unauthorized Financial RPC, and General Cleanup (`20260821050000`–`20260821055000`)

Working through the Supabase security/performance advisor's warning list (285 performance + 86 security at the time) surfaced two real bugs well beyond lint noise, alongside routine cleanup:

- **`commission_allocation` and `commission_clawback` had no agency scoping in their RLS policies at all.** Neither table carries an `agency_id` column, and neither table's policies joined through the chain that would provide one (`calculation_id` → `commission_calculation.deal_id` → `deal.agency_id`) — their sibling parent table, `commission_calculation`, was correctly scoped via `can_access_deal(deal_id)`, but the two child tables were not. `"Managers manage allocations"`/`"clawbacks"` only checked `get_current_role() = any ('admin','admin_agent')`, true for an admin at *any* agency — so any agency's admin could read, insert, update, or delete any other agency's commission payouts and clawbacks. Fixed by adding the same join-based agency check used everywhere else in the schema.
- **`process_monthly_section_86_4_interest_allocation` had `EXECUTE` granted to `authenticated` with zero internal authorization check.** Every other RPC in this codebase gates itself internally (`if get_current_role() not in (...) then raise exception`); this one, meant to run only from the monthly `pg_cron` job, had none. Any logged-in user — a plain agent, not just an admin — could call it directly via `/rest/v1/rpc/process_monthly_section_86_4_interest_allocation` with no arguments (both parameters default: every agency, today's date) and it would post real trust-account interest-credit and PPRA-levy ledger entries, write `audit_log` rows, and notify a principal — a genuine unauthorized financial write, bypassing the schedule and any approval step entirely. **This had already been fixed once** (`20260817000013_fix_quota_and_cron_function_exposure.sql`, which revoked the grant along with the same gap on `generate_daily_notification_digests()`) but silently regressed: `20260819132712_reconcile_live_drift_2.sql`, an auto-generated snapshot of live database state, captured the grant back open — meaning something re-granted it live, outside migrations, sometime between those two dates, and the reconcile process faithfully replayed that drifted, insecure state back into version control. Re-revoked, along with the same unnecessary grant on four `returns trigger` functions that were never callable via RPC in the first place (Postgres refuses to invoke a trigger function outside trigger context) but had the grant anyway.
- **`bond_application` carried a leftover, broader "same agency" policy set** (`agency_id` match via a `deal`/`user_account` join) **alongside the newer `can_access_deal()`-scoped policies** meant to replace it — every sibling deal-child table (`checklist_item`, `deal_participant`, `deal_party`, `deal_stage_history`, `offer`, `suspensive_condition`) only has the newer, narrower set. Because RLS permissive policies `OR` together, the leftover broad policy silently reopened agency-wide visibility into every deal's bond applications for every agent, defeating the narrower restriction entirely. Two more dead-duplicate policies (`notification`, `user_account`) had the identical shape: a replacement policy was added in a later migration without dropping the one it superseded, visible from the replacement being given a *different* policy name than the one the migration's own comment said it was fixing.
- Wrapped the remaining bare `auth.uid()`/`auth.role()` calls the advisor's `auth_rls_initplan` warning flagged (re-evaluated once per row instead of once per query when not wrapped in `(select ...)`), added the 89 missing foreign-key indexes it flagged, and split the 22 tables where an `ALL` policy overlapped its own `SELECT` policy into command-specific `INSERT`/`UPDATE`/`DELETE` policies — verified per table that the `ALL` policy's condition was already equal to or narrower than its sibling `SELECT` policy's, so this only removes a redundant policy evaluation per query, changing nothing about who can do what.

**Follow-up (`20260821060000`):** of the remaining SECURITY DEFINER exposure warnings, 7 functions (plus one two-overload function, `create_deal_full`) turned out to be agent/admin-only actions — invite a user, review a compliance item, approve a maintenance work order, round-robin assign a lead, adjust storage usage, log an audit event, create a deal — that had `EXECUTE` granted to `anon` alongside `authenticated`, even though every one of them resolves its own identity via `get_current_agency_id()`/`get_current_user_account_id()`/`auth.uid()` and rejects when that's `NULL` (which it always is for an anonymous caller — verified by reading each function body before touching grants). Not a live exploit, since anon was already rejected internally, just unnecessary exposure. Revoked `anon` from all of them, leaving `authenticated` untouched.

**Not fixed:** `auth_leaked_password_protection` needs a dashboard toggle (Authentication → Policies → Password → "Leaked password protection") — checked `supabase/config.toml`'s full `[auth]`/`[auth.email]` sections and the linked CLI's config schema; this setting isn't declarable through `config.toml` or the CLI at all, only through the dashboard or a raw Management API call, and no available tool exposes a safe way to make that call. The remaining SECURITY DEFINER "callable by anon/authenticated" warnings are legitimate by design: the identity-helper functions (`get_current_agency_id()`, `is_manager()`, `can_access_deal()`, etc.) are what every RLS policy in this schema calls, so revoking their grants would break RLS evaluation itself; the rest are functions genuinely meant to be called anonymously (public lead capture, e-sign/conveyancer token links, invitation token validation before an account exists) or are agent/admin actions correctly gated to `authenticated` only.

A daily scheduled workflow (`.github/workflows/supabase-advisor-check.yml`, `scripts/check-supabase-advisors.mjs`) now diffs the live project's advisor findings against a committed baseline (`supabase/advisor-baseline.json`) of everything reviewed in this section, and opens an issue on anything new — specifically so the `process_monthly_section_86_4_interest_allocation` regression above (silently reopened between two dates, sitting undetected until this session's manual advisor triage) gets caught automatically next time, not on whatever cadence a human happens to go looking.

The two real access-control bugs found in this section — `commission_allocation`/`commission_clawback`'s missing agency scoping, and `bond_application`'s leftover broad policy — are also now encoded as pgTAP regression tests (`supabase/tests/rls_isolation_test.sql`, run via `supabase test db` in the `database_checks` CI job). Every assertion in that file was run manually against the live project first (postgres role, `BEGIN`/`ROLLBACK`, switching to `authenticated` and mocking `auth.uid()` via `request.jwt.claim.sub`) to confirm the exact expected row counts before being encoded as a test, rather than writing pgTAP blind. `supabase db lint` and the schema-drift check catch schema hygiene and reproducibility, not who can see what — this is the first thing in CI that actually asserts cross-tenant/cross-deal isolation.

## 31. Bundle-Size Budget Check Found a Real Eager Import (`scripts/check-bundle-budget.mjs`)

Building a CI check to prevent a repeat of §27's PDF-designer bundle regression (measuring the app's eagerly-loaded JS/CSS against a fixed budget, using Vite's build manifest to distinguish static `imports` from route-level `dynamicImports`) surfaced a second, live instance of the same failure mode it was meant to guard against: `src/data/pdf-generate.ts` statically imported `@pdfme/generator` and `PDF_PLUGINS` at module scope, despite the file's own header comment saying it was kept separate from `pdf-templates.ts` specifically so pages that don't generate PDFs wouldn't pay for that stack. `@pdfme/generator` pulls in `@pdfme/converter`, which bundles `clawpdf`/`canvg`/`html2canvas` for PDF-to-image conversion this app never uses — ~860KB gzipped. Every route that can generate a PDF (`documents.tsx`, the lease onboarding wizard, `reports/$report.tsx`, the FFC register) paid that cost on render, not on the "Generate" click, because all four statically import from `pdf-generate.ts`.

Fixed by moving `generate`/`PDF_PLUGINS` to a dynamic `import()` inside `renderPdfFromTemplate` (the one function both `useGeneratePdfDocument` and `useDownloadPdfFromTemplate` call), so the weight only downloads when a user actually triggers generation. Measured per-route marginal cost (what visiting the route downloads beyond the shared eager bundle) dropped from ~950–1090KB to ~445–590KB on all four routes. The remaining weight is `@pdfme/common` itself (~375KB gzipped, likely its embedded blank-PDF asset), still statically imported via `pdf-template-layouts.ts`'s `BLANK_A4_PDF` — not chased further here since deferring it would mean making `buildDefaultTemplate` (and everything that calls it, including the template list page's fallback) async, a larger change than this pass's scope; the four routes are still comfortably within their (deliberately generous, allow-listed) per-route budgets.

`npm run check:bundle` runs this after every `npm run build` (wired into `.github/workflows/ci.yml` and `npm run check`). Two things it checks: the total eager bundle against a flat budget, and each route's own marginal cost against a per-route budget (`default: 250KB`, with explicit higher budgets — each with a one-line reason in the script — for the routes that legitimately need to be heavier: the four PDF-generating routes above, the PDF template designer and its list page, the reports chart page, and the email template editor).
- **The RPC never writes the file it claims to generate.** `generate_document_from_template()` computes `v_merged_content` (the merged markdown) but never uploads it anywhere — it only inserts a `document` row pointing at a `storage_key` in R2 that nothing ever wrote to. Calling it "succeeds" (returns a document id) and produces a document list entry that 404s the moment anyone tries to actually open or download it.
