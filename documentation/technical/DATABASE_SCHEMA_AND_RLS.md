# Database Schema & RLS Policies

Dream Supreme is a multi-tenant platform. Supabase handles authentication, and PostgreSQL Row Level Security (RLS) guarantees data isolation.

## 1. Core Entity Schema

### `agency` & `user_account`

- **`agency`**: The top-level tenant.
- **`user_account`**: Links a Supabase Auth `user` to a specific `agency`. Contains the user's operational role (`principal`, `admin`, `agent`, `candidate`).
- **`commission_pct`**: (Recently added) Stores an agent's individual commission split. If `NULL`, the system falls back to the agency's default rules.

### `property`, `mandate`, & `deal`

- **`property`**: The physical real estate asset. Independent of the transaction.
- **`mandate`**: The exclusive or open listing agreement to sell/rent a `property`. Tracks listing price and expiry.
- **`deal`**: The transactional workflow. Links a `property` (and optionally a `mandate`) to `user_account`s (via `deal_participant`). Moves through strict stages (e.g., `Mandate Signed` -> `OTP Signed` -> `Registered`).

### `lease`, `lease_invoice`, & `maintenance_job` (Rentals Module)

- **`lease`**: The core rentals agreement linking a tenant to a property. Owned by a specific `managed_by` rental agent.
- **`lease_invoice`**: Financial tracking for rent, utilities, and deposits against a lease.
- **`maintenance_job`**: Tracks property repairs, linked to a lease and requiring principal/agent approval.

### `commission_rule_set` & `commission_calculation`

- **`commission_rule_set`**: Defines global agency rules (e.g., Office Share %, Franchise Fees, Marketing Deductions).
- **`commission_calculation`**: Triggered when a deal registers. Calculates the gross commission, subtracts deductions, and allocates the remaining net commission to the agents (`commission_allocation`).

## 2. Row Level Security (RLS) Strategy

All tables enforce RLS to guarantee data boundaries.

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

### `admin_bulk_retire_users(p_user_ids)`

Changes multiple users' statuses to `'archived'` securely in one transaction and automatically writes to the `audit_log`.

### `admin_bulk_reset_commission(p_user_ids)`

Sets an array of users' `commission_pct` to `NULL`, forcing them to inherit the default agency rules again. Writes to the `audit_log`.

## 4. Triggers & Automation

- **`deal_stage_history`**: A Postgres trigger automatically records an entry in `deal_timeline` whenever a deal's `stage` column is updated.
- **`audit_log`**: Crucial actions (like commission finalization, user archival, entity updates) write to `audit_log` for complete financial transparency.
- **`pg_cron` (Scheduled Jobs)**: Used for automated daily background tasks. For example, `run_daily_sweeps()` runs every night at midnight to check all FFC certificates and automatically suspends accounts if their FFC has expired.
