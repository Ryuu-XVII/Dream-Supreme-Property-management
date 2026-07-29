-- =============================================================================
-- 001_extensions.sql
-- Enable required PostgreSQL extensions
-- =============================================================================

-- UUIDs for primary keys
create extension if not exists "uuid-ossp" schema extensions;

-- pgcrypto for hashing (tokens, signatures)
create extension if not exists "pgcrypto" schema extensions;

-- moddatetime for auto-updating updated_at timestamps
create extension if not exists "moddatetime" schema extensions;
