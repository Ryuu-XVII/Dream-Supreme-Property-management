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
- `idx_whatsapp_queue_status_attempts`: WhatsApp queue dispatcher (`status`, `attempts`, `created_at`).
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

### `match_buyers_for_mandate(p_mandate_id)`

Cross-references new property mandates against registered buyer criteria profiles (budget ranges, preferred suburbs, property types, room counts) and calculates a 0-100% weighted match score.

### `calculate_tiered_commission_splits(p_deal_id)`

Calculates complex multi-tiered sliding scale commission splits. It dynamically fetches the agency's default commission rate from `commission_rule_set` and VAT rate from `get_vat_rate()`. Deducts VAT, franchise royalty fees, and desk fees before outputting exact agent net payouts and agency retention balances.

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
- **`trigger_deal_stage_whatsapp_notification()` Trigger**: Fires on `deal.stage` transitions to `bond_approved`/`registered` and queues `whatsapp_queue` messages to the buyer/seller. Also fixed in `20260814000005_fix_deal_notification_address_column.sql` — it referenced a non-existent function, `dp.role = 'buyer'` when `deal_party.role` only has `'purchaser'`, and `p.phone`/`deal.address`, none of which exist (the party phone column is `mobile`; address must be joined via `property_id`).
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
