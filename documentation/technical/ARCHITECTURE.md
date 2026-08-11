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
2. **Role Guard**: `/admin/*` separately requires an active `admin` or `principal` account. Administrative-domain detection is used only for portal routing and cannot bypass the account-role check.
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
    /admin         # Admin Portal routes (Agency Config, Commission Rules, System Settings)
    /deals         # Agent Portal deal routes
    /settings      # Agent personal preferences (My Profile)
/supabase
  /migrations      # PostgreSQL schema, functions, and RLS policies
```

## 5. Security Principles & Storage

- **Never Trust the Client**: While `AuthGuard` handles UI routing, true data security is enforced at the database layer using Postgres Row Level Security (RLS). Even if a user bypasses the UI blocks, Supabase will reject queries they are not authorized for.
- **No Shared Secrets**: The application only ships with the `VITE_SUPABASE_ANON_KEY`, relying strictly on JWTs for authorization.
- **Cloudflare R2 Integration & Storage Isolation**: We utilize an S3-compatible storage adapter (`src/lib/storage.ts`) via `@aws-sdk/client-s3` targeting Cloudflare R2 buckets (`dream-supreme-documents`) for all files (FFCs, FICA documents, Deal PDFs, and avatars). Each agent has an isolated storage folder namespace (`users/<user_account_id>/...`).
- **Per-Agent 1 GB Storage Quotas & Admin Controls**: Each user account is assigned a default 1 GB storage quota limit (`1,073,741,824 bytes`) tracked via `storage_limit_bytes` and `storage_used_bytes` in `public.user_account`. Admins can inspect agent storage usage progress bars and upgrade/modify quota allocations (e.g. 500MB, 1GB, 2GB, 5GB, 10GB, 20GB, or custom limits) via the **Admin > Team & Users** management portal.
- **Storage Fallback & Signed URLs**: If R2 environment credentials (`VITE_R2_ACCOUNT_ID`, `VITE_R2_ACCESS_KEY_ID`, `VITE_R2_SECRET_ACCESS_KEY`) are unconfigured, storage transparently falls back to Supabase Storage (`mandate-documents`). All files remain strictly private, accessed via 300-second presigned URLs (`getR2FileUrl`) or configured R2 public custom domain URLs (`VITE_R2_PUBLIC_URL`).

## 6. Developer Guidelines

To make ongoing development easier and more predictable, please follow these conventions:

1. **Routing Strategy**: Always use `createFileRoute` provided by `@tanstack/react-router`. Avoid traditional React Router constructs. Keep data loading local to the route or inside a dedicated TanStack Query hook.
2. **Component Granularity**: If a UI chunk exceeds 150 lines inside a Route component, break it out into a sub-component within the same file or move it to `src/components/` if it can be reused.
3. **State Management**: Prefer server-state (TanStack Query) over client-state (Context/Zustand) wherever possible. Only use global state (`useApp`) for purely visual UI states like sidebar toggles.
4. **Forms and Validation**: Standardize on `react-hook-form` and `zod` for all form parsing and validation to guarantee type-safe data reaches the database.
