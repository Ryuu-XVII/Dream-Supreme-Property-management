# System Architecture & Design

This document outlines the core architecture of the Dream Supreme Property Management application.

## 1. Technology Stack

- **Frontend Framework**: React 19, Vite 8, TypeScript 5
- **Routing**: `@tanstack/react-router` (File-based routing with automatic route tree generation)
- **Data Fetching/Caching**: `@tanstack/react-query`
- **Styling & Audio**: Tailwind CSS v4 (`@import "tailwindcss"` with inline theme definitions and OKLCH color palettes), `lucide-react`, `framer-motion` (animations), `shadcn/ui` (accessible components), Web Audio API Synthesizer (`src/lib/sound.ts`)
- **PDF Generation**: Client-side `jspdf` & `jspdf-autotable` B2B document builder (`src/lib/pdf-generator.ts`)
- **Backend / Database**: Supabase (PostgreSQL, Auth, RLS), Cloudflare R2 Storage adapter (`src/lib/storage.ts`)

## 2. Portal Separation (RBAC)

The application operates as a **Monolith with Subdirectory Routing**, serving two distinct portals based on the user's authenticated role (`Agent`, `Admin`):

- **Agent Portal (Main App / Subdomain)**: Hosted on the practitioner domain (e.g., `app.dreamsupreme.co.za` or `agent.dreamsupreme.co.za`). Wrapped by `<AppShell>` for daily practitioner operations (Listings, Rentals, Deal Flow, Countdown, Commission, Clients, Documents, Reports, and a 4-tab Settings Hub for Profile & Security, Financials & Goals, Signing Presets, and Notifications). Restricted to Agents and Admins.
- **Admin Portal (Management Subdomain)**: Hosted on the administrative domain (e.g., `admin.dreamsupreme.co.za`). Wrapped by `<AdminShell>` with dedicated controls. Shares the exact same ambient mesh background, glassmorphic sidebar, and design system aesthetics as the Agent Portal. Access requires an active Supabase account with the `admin` or `principal` role; the hostname never grants authorization.
- **Public Entry Points**: `/login`, `/reset-password`, `/register`, `/calculators/*`, `/conveyancer`, `/sign`, and `/sitemap.xml` are explicitly allowlisted. Conveyancer and signing routes are intended for separate token-validation workflows and do not require staff accounts.

**Design System & Typography**:

- **Google Fonts CDN**: Platform typography relies on Google Fonts loaded via `<link>` tags in `index.html` and preconnected to `https://fonts.googleapis.com`.
  - **Inter**: Primary sans-serif font for body text, tables, forms, and general UI (`--font-sans`).
  - **Outfit**: Display font for page titles, headings, and branding elements (`--font-display`).
  - **JetBrains Mono**: Monospace font for financial values, deal numbers, and system logs (`--font-mono`).

**Testing & Calculation Engine**:

- Spreadsheet multi-tier commission waterfall formulas (Royalty, Franchise, Office Split, Desk Fee) are unit tested in [`tests/agent-commission-spreadsheet.test.ts`](file:///c:/Personal%20Projects/FOCI%20PROJECTS/Dream-Supreme-Property-management/tests/agent-commission-spreadsheet.test.ts).

**Domain & RBAC Enforcement Strategy**:

1. **Authenticated Root Guard**: `<AuthProvider>` wraps `<AppProvider>`. `AuthenticatedOutlet` waits for Supabase session restoration, permits only the explicit public-route allowlist without a session, and redirects every other route to `/login` unless both a session and active `user_account` profile exist.
2. **Role Guard**: `/admin/*` separately requires an active `admin` account. Administrative-domain detection is used only for portal routing and cannot bypass the account-role check.
3. **Unified Supabase RLS Authority**: Both domains share the single Supabase PostgreSQL backend. Client guards control navigation, while PostgreSQL RLS remains authoritative for records, FFC approvals, commission waterfalls, and other protected operations.

## 3. State Management

State is separated into three distinct domains:

1. **Global App State (`src/lib/app-state.tsx`)**:
   - Manages UI preferences like `theme` (light/dark/system) and `sidebarCollapsed`.
   - Stores the derived `role` for fast UI conditional rendering (e.g., hiding the Admin Dashboard link).
2. **Session State (`src/lib/auth.tsx`)**:
   - Manages the active Supabase `Session` and `User`.
   - Fetches and stores the enriched `account` object from the `user_account` table to provide the user's full name, agency ID, and role immediately upon login.
   - Subscribes to Supabase auth-state changes, clears impersonation on sign-out, and exposes `refreshAccount()` so invitation registration can load the newly provisioned profile before navigating into protected routes.
   - Password login calls `supabase.auth.signInWithPassword`; password recovery uses `resetPasswordForEmail` and the public `/reset-password` completion route. No simulated client-side OTP is used.
3. **Server State (TanStack Query)**:
   - Used for fetching, caching, and mutating database records. Found in the `src/data/` directory hooks (e.g., `usePipelineDeals`, `useAuditLogs`).

## 4. Directory Structure

```text
/src
  /components
    /admin         # Admin Portal specific components (AdminShell, Charts, Global Config)
    /deal          # Deal & Mandate components (QuickDealModal - 60s express deal capture; ProgressNoteModal - activity logging; StageGateModal - interactive prerequisite checklist)
    /layout        # Main Agent Portal shell (AppShell, Sidebar with Mandates/Rentals/Clients, Header)
    /ui            # Shadcn UI primitives (Buttons, Inputs, Dialogs, Selects)
  /data            # TanStack Query hooks and mock data fallbacks
  /lib             # Core utilities (Auth, Supabase client, Formatting, State)
  /routes          # TanStack Router file-based route definitions
    __root.tsx     # Root context and AuthGuard enforcement
    /admin         # Admin Portal routes (Agency Config, Commission Rules, System Settings & Governance Hub with System Health, Cloudflare R2 Governance, Security & Access Rules, Notification Dispatchers, and Automated Maintenance Policies)

    /deals         # Agent Portal deal routes
    /settings      # Agent personal preferences (My Profile)
/supabase
  /migrations      # PostgreSQL schema, functions, and RLS policies
```

## 5. Security Principles & Storage

- **Never Trust the Client**: While `AuthGuard` handles UI routing, true data security is enforced at the database layer using Postgres Row Level Security (RLS). Even if a user bypasses the UI blocks, Supabase will reject queries they are not authorized for.
- **No Shared Secrets**: The application only ships with the `VITE_SUPABASE_ANON_KEY`, relying strictly on JWTs for authorization.
- **Cloudflare R2 Integration & Storage Isolation**: Actual file bytes (FFCs, FICA documents, Deal PDFs, avatars) live in a Cloudflare R2 bucket (`dream-supreme-documents`); only object metadata (filename, size, mime type, storage key) lives in Postgres, via the `document` table. R2 has no browser-safe, RLS-scoped credential comparable to Supabase's anon key, so no R2 credential is ever shipped to the client — the `r2-storage` Supabase Edge Function (`supabase/functions/r2-storage`) holds the R2 IAM credentials as server-side secrets and hands the browser short-lived presigned PUT/GET URLs. The client (`src/lib/storage.ts`) uploads/downloads directly to/from R2 using those presigned URLs; the file bytes never pass through Supabase. Each agent has an isolated storage folder namespace (`users/<user_account_id>/...`).
- **Per-Agent 1 GB Storage Quotas & Admin Controls**: Each user account is assigned a default 1 GB storage quota limit (`1,073,741,824 bytes`) tracked via `storage_limit_bytes` and `storage_used_bytes` in `public.user_account`. Admins can inspect agent storage usage progress bars and upgrade/modify quota allocations (e.g. 500MB, 1GB, 2GB, 5GB, 10GB, 20GB, or custom limits) via the **Admin > Team & Users** management portal.
- **Two CORS Layers (both required)**: Because the browser talks to two different hosts, both must allow the app's origin or uploads fail. (1) The `r2-storage` Edge Function returns `Access-Control-Allow-*` headers and answers the preflight `OPTIONS` request itself. (2) The R2 bucket needs its own CORS policy, since the browser `PUT`s file bytes straight to `<account>.r2.cloudflarestorage.com`. That policy is committed as `r2-cors.json` and applied with `npx wrangler r2 bucket cors set dream-supreme-documents --file r2-cors.json`. **Adding a new app domain requires adding it to `r2-cors.json` and re-applying** — otherwise the presigned URL is issued successfully but the browser blocks the upload.
- **No Storage Fallback, Signed URLs Only**: The `r2-storage` Edge Function requires the `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` Supabase secrets (set via `supabase secrets set`, never in `.env`/`VITE_`-prefixed variables). Note these are Supabase *function* secrets — putting them in a local `.env`/`.env.local` does nothing, because the function runs on Supabase's infrastructure and never reads your local files. There is no Supabase Storage fallback: if those secrets are unset or the function is unreachable, `src/lib/storage.ts` throws rather than silently storing bytes anywhere else — the **Admin > System Settings > Document Storage** card surfaces this as a hard "Not Configured" error state, not a soft degradation. All files remain strictly private, accessed via 300-second presigned R2 URLs (`getR2FileUrl`).

## 6. Developer Guidelines

To make ongoing development easier and more predictable, please follow these conventions:

1. **Routing Strategy**: Always use `createFileRoute` provided by `@tanstack/react-router`. Avoid traditional React Router constructs. Keep data loading local to the route or inside a dedicated TanStack Query hook.
2. **Component Granularity**: If a UI chunk exceeds 150 lines inside a Route component, break it out into a sub-component within the same file or move it to `src/components/` if it can be reused.
3. **State Management**: Prefer server-state (TanStack Query) over client-state (Context/Zustand) wherever possible. Only use global state (`useApp`) for purely visual UI states like sidebar toggles.
4. **Forms and Validation**: Standardize on `react-hook-form` and `zod` for all form parsing and validation to guarantee type-safe data reaches the database.
