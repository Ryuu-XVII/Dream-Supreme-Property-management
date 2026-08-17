-- Fixes a 500 "Database error querying schema" that made the seeded master admin
-- account impossible to log in with.
--
-- Root cause: 20260807000000_seed_master_admin.sql INSERTs directly into
-- auth.users without supplying the token/email-change columns, so they default
-- to NULL. GoTrue (written in Go) scans those columns into non-nullable string
-- fields, and a NULL makes the scan fail — which surfaces to the client as a
-- generic HTTP 500 "Database error querying schema" rather than an auth error.
-- Accounts created through the normal GoTrue signup flow set these to '' and are
-- unaffected, so only the hand-seeded admin row was broken.
--
-- The fix is to normalise NULL -> '' on every affected column. This is safe and
-- idempotent: '' is exactly what GoTrue itself writes for "no token pending".

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where
  confirmation_token is null
  or recovery_token is null
  or email_change is null
  or email_change_token_new is null
  or email_change_token_current is null
  or phone_change is null
  or phone_change_token is null
  or reauthentication_token is null;
