# Dream Supreme Property Management - Security Architecture

This document defines the core security constraints and architectural guidelines for the platform. As a system handling sensitive Personally Identifiable Information (PII) and financial transactions, strict adherence to these principles is mandatory.

## 1. Authentication & Authorization

- **Supabase Auth:** All authentication is handled via Supabase (JWT tokens).
- **Role-Based Access Control (RBAC):** Users are assigned specific roles (e.g., `admin`, `agent`, `principal`, `compliance_officer`). Access to features and UI elements must be strictly gated by these roles.
- **Principle of Least Privilege:** A user should only have access to the data necessary for their specific job function.

## 2. Row-Level Security (RLS)

RLS is the primary defense mechanism against unauthorized data access. The application layer **MUST NOT** be trusted to filter data.

- **Strict RLS:** Every table in the Supabase PostgreSQL database must have RLS enabled.
- **Agency Isolation:** Data is strictly isolated by `agency_id`. An agent can only read/write data associated with their agency.
- **Role-Based Policies:** RLS policies must utilize `public.get_current_role()` to enforce permissions (e.g., an `agent` can only view their own deals, while a `principal` can view all deals in their agency).
- **Bypass Prevention:** System-level overrides (`service_role` key) must be strictly limited to background jobs and webhook handlers.

## 3. Data Privacy and PII (Personally Identifiable Information)

- **Minimization:** Only collect PII that is absolutely necessary for FICA compliance or legal contracting.
- **Masking:** Sensitive data (like full ID numbers or bank account details) should be masked in the UI unless explicitly required by the user's role.
- **Avoid Over-fetching:** API requests (Supabase queries) must explicitly select only the required columns (`.select('id, name')`) instead of fetching entire rows containing PII.

## 4. Encryption & Network Security

- **In Transit:** All communication between the client and server must occur over TLS 1.2+ (HTTPS/WSS).
- **At Rest:** Supabase provides AES-256 encryption at rest. Highly sensitive fields (e.g., financial API keys, third-party integration secrets) must be encrypted at the application level using a secure vault or Vault extension before being stored.

## 5. File Storage Security

- **Private Buckets:** Uploaded documents (FICA documents, ID copies, signed contracts) MUST be stored in private storage buckets.
- **Signed URLs:** Access to these documents must be granted via short-lived signed URLs, generated dynamically based on the user's active session and RLS permissions.

## 6. Audit Logging

- **Immutability:** Critical actions (e.g., changing a FICA status, approving a deal, updating commission structures) must generate immutable audit logs.
- **Event Tracking:** Logs must capture the user ID, timestamp, action performed, and a snapshot of the before/after state to maintain compliance and traceability.
