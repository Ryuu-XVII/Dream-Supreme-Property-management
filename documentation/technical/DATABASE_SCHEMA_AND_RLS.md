# Database Schema & RLS Policies

Dream Supreme is a multi-tenant platform. Supabase handles authentication, and PostgreSQL Row Level Security (RLS) guarantees complete multi-tenant data isolation across all tables including `config_transfer_duty`, `email_queue`, and validated `lead` insertions requiring `full_name`.

## 1. Core Entity Schema

### `agency` & `user_account`

- **`agency`**: The top-level tenant.
- **`branch`**: Physical office locations belonging to an agency. Tracks granular operational settings like `lead_auto_assign`.
- **`user_account`**: Links a Supabase Auth `user` to a specific `agency` and optionally a `branch`. Contains the user's operational role (`principal`, `admin`, `agent`, `candidate`).
- **`commission_pct`**: (Recently added) Stores an agent's individual commission split. If `NULL`, the system falls back to the agency's default rules.

### `property`, `mandate`, & `deal`

- **`property`**: The physical real estate asset. Independent of the transaction.
- **`mandate`**: The exclusive or open listing agreement to sell/rent a `property`. Tracks listing price and expiry.
- **`deal`**: The transactional workflow. Links a `property` (and optionally a `mandate`) to `user_account`s (via `deal_participant`). Moves through strict stages (e.g., `Mandate Signed` -> `OTP Signed` -> `Registered`).

### `lease`, `lease_invoice`, `lease_escalation_schedule` & `maintenance_job` (Rentals Module)

- **`lease`**: The core rentals agreement linking a tenant to a property. Owned by a specific `managed_by` rental agent.
- **`lease_invoice`**: Financial tracking for rent, utilities, and deposits against a lease.
- **`lease_escalation_schedule`**: Tracks scheduled annual CPI/fixed rent escalations.
- **`maintenance_job`**: Tracks property repairs, linked to a lease and requiring principal/agent approval.

### `trust_account_ledger` & `document_template` (Trust & Compliance Operations)

- **`trust_account_ledger`**: Audited sub-ledger for Section 86(2) General and Section 86(4) Investment trust deposits, managing 95%/5% client vs PPRA statutory interest allocations and principal sign-offs.
- **`document_template`**: Template repository for auto-generating ECTA-compliant mandates, lease agreements, and OTP legal documents.

### `notification`, `notification_preference`, `user_notification_preference` & `email_queue` (System & User Alert Engine)

- **`notification`**: In-app and agency-wide system alerts supporting user-specific (`user_id` / `user_account_id`) and broadcast channels.
- **`notification_preference`**: Agency-wide settings defining the default channels (email vs. in-app) for different events (e.g., deal updates). Supports JSONB `condition_config` thresholds.
- **`user_notification_preference`**: User-level overrides for the agency defaults. Allows individuals to toggle on/off emails/in-app alerts, define JSONB `condition_config`, and choose delivery `frequency` ('realtime' vs 'digest').
- **`email_queue`**: Transactional email dispatch queue for automated compliance, deal updates, and task reminders.

### `commission_rule_set` & `commission_calculation`

- **`commission_rule_set`**: Defines global agency rules (e.g., Office Share %, Franchise Fees, Marketing Deductions).
- **`commission_calculation`**: Triggered when a deal registers. Calculates the gross commission, subtracts deductions, and allocates the remaining net commission to the agents (`commission_allocation`).

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
- `idx_document_maintenance_job`: Links photo evidence to a maintenance job (`maintenance_job_id`).
- `idx_commission_allocation_calc_user`: Commission allocation payee (`calculation_id`, `user_account_id`).

## 4. Row Level Security (RLS) Strategy

All tables enforce RLS to guarantee data boundaries. All policy comparisons against `auth.uid()` enforce explicit `::uuid` type casting (`auth.uid()::uuid = auth_user_id`) to prevent PostgreSQL type mismatch errors.

### Multi-Tenant Isolation

Every table (except `agency`) has an `agency_id` column. A PostgreSQL helper function `public.get_current_agency_id()` securely extracts the user's agency from their JWT.
Most SELECT policies start with: `agency_id = public.get_current_agency_id()`.

### Role-Based Access Control (RBAC)

Another helper `public.get_current_role()` extracts the user's role from their `user_account`.

- **Principals & Admins**: Can view, edit, and delete almost all records within their `agency_id`.
- **Agents & Candidates**: Can only view and edit records they are explicitly assigned to (e.g., a `deal` where they exist in `deal_participant`).

### `managed_by` Edit Rights (Rentals)

For the Rentals module, read access is granted to the entire agency for transparency, but write/edit access on a `lease` (and its invoices/maintenance) is strictly limited to the `managed_by` agent via the `public.can_edit_lease()` RLS helper function.

## 3. Remote Procedure Calls (RPCs)

We utilize Postgres functions (RPCs) to handle complex transactions that require strict data integrity and audit logging.

### `calculate_deal_commission(p_deal_id, p_rule_set_id)`

Calculates the exact net payable amounts for all participants on a deal using a cascading waterfall approach. Supports dynamically calculating franchise/marketing fees based on the remaining commission pool (`percentage_of_remaining`). Re-runnable (archives previous calculations). Restricted to Principals and Admins.

### `get_vat_rate()`

A central configuration function that returns the current VAT rate (`0.15`). Used consistently by the commission calculations to prevent hardcoded VAT percentages.

### `record_trust_transaction(p_deal_id, p_lease_id, p_account_type, p_transaction_type, ...)`

Enforces single-principal approval for Section 86 trust sub-ledger transactions, automatically stamping approval metadata and writing structured records to `audit_log`.

### `process_monthly_section_86_4_interest_allocation(p_agency_id, p_period_date)`

Calculates statutory 95%/5% interest splits on Section 86(4) trust investment balances under the Property Practitioners Act 22 of 2019. Automatically posts dual ledger transactions (`interest_credit` and `ppra_levy_deduction`), logs audit trail entries, and generates principal notifications. Scheduled via `pg_cron` (`0 1 1 * *`).

### `review_compliance_item(p_checklist_id, p_status, p_rejection_notes)`

Enforces agency principal/admin approval or rejection of mandatory transaction compliance checklist items (FICA, PPA Section 67 disclosure, FFC validation), recording review status and audit timestamps.

### `match_buyers_for_mandate(p_mandate_id)`

Cross-references new property mandates against registered buyer criteria profiles (budget ranges, preferred suburbs, property types, room counts) and calculates a 0-100% weighted match score.

### `calculate_tiered_commission_splits(p_deal_id)`

Calculates complex multi-tiered sliding scale commission splits. It dynamically fetches the agency's default commission rate from `commission_rule_set` and VAT rate from `get_vat_rate()`. Deducts VAT, franchise royalty fees, and desk fees before outputting exact agent net payouts and agency retention balances.

### `assign_lead_round_robin(p_lead_id)`

Distributes incoming omnichannel leads dynamically among active agents using an automated round-robin algorithm based on current active lead count and creation timestamps.

### `approve_maintenance_work_order(p_ticket_id, p_contractor_amount_cents)`

Enforces agency principal approval for tenant maintenance work orders and contractor quotes, updating ticket status and auto-logging contractor invoice deductions for landlord trust disbursements.

### `generate_document_from_template(p_template_id, p_deal_id, p_lease_id)`

Executes server-side document merge substitution on template markdown, creates the generated document entry in `public.document`, and logs an automated audit entry.

### `create_lease_onboarding(p_payload jsonb)`

Executes atomic lease onboarding, inserting the `lease` record, trust deposit ledger entries, initial pro-rata rent invoice, and ingoing inspection schedule in a single audited transaction.

### `admin_bulk_retire_users(p_user_ids)`

Changes multiple users' statuses to `'archived'` securely in one transaction and automatically writes to the `audit_log`.

### `admin_bulk_reset_commission(p_user_ids)`

Sets an array of users' `commission_pct` to `NULL`, forcing them to inherit the default agency rules again. Writes to the `audit_log`.

### `generate_daily_notification_digests()`

Aggregates all notifications with a `delivery_status` of `'pending_digest'` for users who have opted into digest frequency. Generates a combined HTML email and inserts it into `email_queue`. Scheduled via `pg_cron` at 08:00 UTC daily.

## 4. Triggers & Automation

- **`deal_stage_history`**: A Postgres trigger automatically records an entry in `deal_timeline` whenever a deal's `stage` column is updated.
- **`audit_log`**: Crucial actions (like commission finalization, user archival, entity updates) write to `audit_log` for complete financial transparency.
- **`pg_cron` (Scheduled Jobs)**: Used for automated daily background tasks. For example, `run_daily_sweeps()` runs every night at midnight to check all FFC certificates and automatically suspends accounts if their FFC has expired.
