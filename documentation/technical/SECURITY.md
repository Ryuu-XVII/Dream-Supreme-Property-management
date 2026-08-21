# Dream Supreme Property Management - Security Architecture

This document defines the core security constraints and architectural guidelines for the platform. As a system handling sensitive Personally Identifiable Information (PII) and financial transactions, strict adherence to these principles is mandatory.

## 1. Authentication & Authorization

- **Supabase Auth:** All authentication is handled via Supabase (JWT tokens).
- **Role-Based Access Control (RBAC):** Users are assigned one of the database roles (`admin`, `agent`, or `admin_agent`, the last holding both admin and agent permissions). Access to features and UI elements must be strictly gated by these roles.
- **Principle of Least Privilege:** A user should only have access to the data necessary for their specific job function.
- **Active Profile Requirement:** Protected routes require both a valid Supabase session and an active `user_account` record. Suspended, archived, orphaned, or unprovisioned Auth users cannot enter the operational portal.
- **Administrative Access:** An admin hostname is a routing convenience only. `/admin/*` requires an active `admin` or `admin_agent` profile regardless of the host used to reach it.
- **Password Authentication:** Login uses `supabase.auth.signInWithPassword`. New registrations and password changes require at least eight characters. Existing users authenticate against the server policy configured in the deployed Supabase project.
- **Password Recovery:** Reset emails return to the public `/reset-password` route, which requires the recovery session issued by Supabase before calling `auth.updateUser`. Normal in-app password changes first reauthenticate the current password.
- **MFA:** TOTP is enrolled and managed from Settings → Two-factor authentication (`src/components/settings/mfa-settings.tsx`) via `supabase.auth.mfa.enroll`/`challengeAndVerify`/`unenroll` — real Supabase-verified factors only. Login (`src/routes/login.tsx`) checks `getAuthenticatorAssuranceLevel()` after password sign-in and, if the account has a verified factor, requires a 6-digit code (`challengeAndVerify`) before completing sign-in. The UI must not claim MFA is active unless enrollment and challenge verification are implemented and enabled this way; there are no hard-coded OTP or demo-login paths. The hard-coded master-admin fallback credential (`login.tsx`) is a deliberate, separately-tracked exception and does not go through this MFA check.

## 2. Row-Level Security (RLS)

RLS is the primary defense mechanism against unauthorized data access. The application layer **MUST NOT** be trusted to filter data.

- **Strict RLS:** Every table in the Supabase PostgreSQL database must have RLS enabled.
- **Agency Isolation:** Data is strictly isolated by `agency_id`. An agent can only read/write data associated with their agency.
- **Role-Based Policies:** RLS policies must utilize `public.get_current_role()` to enforce permissions (e.g., an `agent` can only view their own deals, while `admin`/`admin_agent` can view all deals in their agency).
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
