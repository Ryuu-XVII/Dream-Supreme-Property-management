# Dream Supreme Property Operations

An internal South African estate-agency operations platform for mandates, deals, suspensive conditions, documents, FFC compliance, leads, audit trails, and commission calculations. The product is a React/Vite client backed by Supabase Auth, PostgreSQL, Row Level Security, and private Supabase Storage.

The product requirements and legal/operational scope are in [Mandate_Product_Technical_Specification_v1.md](Mandate_Product_Technical_Specification_v1.md). The researched field matrices and validation policies are in [DEAL_CAPTURE_REQUIREMENTS.md](DEAL_CAPTURE_REQUIREMENTS.md) and [CLIENT_ONBOARDING_REQUIREMENTS.md](CLIENT_ONBOARDING_REQUIREMENTS.md).

## Local setup

Requirements: Node.js 22+, npm, Supabase CLI, and Docker Desktop for the local database.

```bash
npm ci
copy .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Copy the local API URL and anon key printed by `supabase start` into `.env.local`. The application refuses to start when either value is missing; there are no embedded fallback credentials.

Run the complete verification suite with:

```bash
npm run check
```

This runs TypeScript, ESLint, Vitest, and a code-split production build.

## First principal bootstrap

Registration is invitation-only. For a new installation:

1. Apply all migrations and seed data.
2. Create the first principal in Supabase Authentication (Dashboard or Admin API).
3. From a trusted server using the Supabase `service_role` key, invoke `bootstrap_principal` once with the agency slug, Auth user UUID, matching email, and full name.
4. Sign in as that principal and invite all subsequent users from Settings > Users.

Never expose the `service_role` key to this Vite application. The bootstrap function refuses to run after an agency has a principal.

## Production deployment

1. Create a Supabase project and configure production Auth URLs and SMTP.
2. Apply migrations with `npx supabase db push` and load the production seed or equivalent agency configuration.
3. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_PUBLIC_AGENCY_SLUG` in the build environment.
4. Build with `npm ci && npm run check`.
5. Deploy `dist/` behind an HTTPS host with SPA fallback. The supplied multi-stage `Dockerfile` and `nginx.conf` provide that setup.
6. Schedule a trusted daily call to `run_daily_sweeps()` using the `service_role` credential. The database function queues in-app reminders; outbound email delivery still requires the chosen SMTP/worker adapter.
7. Enable backups, point-in-time recovery where available, alerting, and database log retention appropriate for POPIA records.

## Security and legal controls

- Agency isolation and role access are enforced in PostgreSQL RLS, not by UI controls.
- Deal creation, stage transitions, cancellation, condition changes, commission calculation, invitations, and public status updates use database functions with audit entries.
- Documents are private and opened through short-lived signed URLs. No object-store secret is shipped to the browser.
- Commission calculation is blocked when a participating practitioner lacks a valid FFC or percentage splits do not total 100%.
- Cancelling a deal reverses calculations and raises clawbacks for confirmed agent allocations.
- Conveyancer links are hashed, scoped to one deal, expiring, and single-use.
- Electronic signing deliberately fails closed. It must not be enabled until real server-side OTP delivery, one-time signing tokens, immutable signature persistence, IP/user-agent capture, and artefact hashing have been implemented and the permitted document categories confirmed by the agency's conveyancer.
- Transfer-duty brackets are seeded from the SARS schedule effective 1 April 2026. Tax and fee schedules must be reviewed at every fiscal change; the calculator remains an estimate, not tax advice.

## Release boundaries

Infrastructure-specific work cannot be completed inside the repository: production Supabase provisioning, SMTP credentials, DNS/TLS, backup policy, scheduler setup, and legal sign-off. Do not call an environment production-ready until those items are configured and the migration has passed against that exact Supabase project.
