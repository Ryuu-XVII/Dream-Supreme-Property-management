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
- **`document_template`**: Template repository for auto-generating ECTA-compliant mandates, lease agreements, and OTP legal documents.

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
