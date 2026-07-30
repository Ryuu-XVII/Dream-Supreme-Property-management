# Database Schema & RLS Policies

Dream Supreme is a multi-tenant platform. Supabase handles authentication, and PostgreSQL Row Level Security (RLS) guarantees data isolation. 

## 1. Core Entity Schema

### `agency` & `user_account`
- **`agency`**: The top-level tenant. 
- **`user_account`**: Links a Supabase Auth `user` to a specific `agency`. Contains the user's operational role (`principal`, `admin`, `agent`, `candidate`). 
- **`commission_pct`**: (Recently added) Stores an agent's individual commission split. If `NULL`, the system falls back to the agency's default rules.

### `property` & `deal`
- **`property`**: The physical real estate asset. Independent of the transaction.
- **`deal`**: The transactional workflow. Links a `property` to `user_account`s (via `deal_participant`). Moves through strict stages (e.g., `Mandate Signed` -> `OTP Signed` -> `Registered`).

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

## 3. Remote Procedure Calls (RPCs)

We utilize Postgres functions (RPCs) to handle complex transactions that require strict data integrity and audit logging.

### `calculate_deal_commission(p_deal_id, p_rule_set_id)`
Calculates the exact net payable amounts for all participants on a deal. Re-runnable (archives previous calculations). Restricted to Principals and Admins.

### `admin_bulk_retire_users(p_user_ids)`
Changes multiple users' statuses to `'archived'` securely in one transaction and automatically writes to the `audit_log`.

### `admin_bulk_reset_commission(p_user_ids)`
Sets an array of users' `commission_pct` to `NULL`, forcing them to inherit the default agency rules again. Writes to the `audit_log`.

## 4. Triggers & Automation
- **`deal_stage_history`**: A Postgres trigger automatically records an entry in `deal_timeline` whenever a deal's `stage` column is updated.
- **`audit_log`**: Crucial actions (like commission finalization, user archival, entity updates) write to `audit_log` for complete financial transparency.
