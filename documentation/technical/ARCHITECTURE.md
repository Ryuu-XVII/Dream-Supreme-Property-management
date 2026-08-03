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

The application operates as a **Monolith with Subdirectory Routing**, serving two distinct portals based on the user's authenticated role (`Principal`, `Admin`, `Agent`, `Candidate`):

- **Agent Portal (Main App)**: Resides in the root (`/`, `/mandates`, `/rentals`, `/pipeline`, `/countdown`, `/commission`, `/clients`, `/compliance/ffc`, `/documents`, `/calculators/bond`, `/leads`, `/reports`, `/settings/agency`). Wrapped by `<AppShell>` which includes the full sidebar navigation (Dashboard, Mandates, Rentals, Pipeline, Countdown Board, Commission, Clients, Compliance, Documents, Calculators, Leads, Reports, Settings) and top header with quick action buttons (Quick Calculator link, New Deal modal trigger, Theme switcher, Notification popover, and User avatar menu). Restricted to Agents, Candidates, and Principals.
- **Admin Portal**: Resides under `/admin/*`. Wrapped by `<AdminShell>` with its own dedicated sidebar and header. Restricted strictly to Admins and Principals.
- **Conveyancer Portal (Public Links)**: Resides under `/conveyancer`. This is a standalone, public-facing portal accessed via secure "magic links" (URL tokens). Conveyancers do NOT require user accounts and do not use the standard login flow.

**Enforcement Strategy**:
Role-Based Access Control (RBAC) is enforced client-side via the `<AuthGuard>` in `src/routes/__root.tsx`.

- If an `Admin` attempts to navigate to a root path, they are immediately redirected to `/admin`.
- If an `Agent` attempts to navigate to `/admin`, they are bounced back to `/`.

## 3. State Management

State is separated into three distinct domains:

1. **Global App State (`src/lib/app-state.tsx`)**:
   - Manages UI preferences like `theme` (light/dark/system) and `sidebarCollapsed`.
   - Stores the derived `role` for fast UI conditional rendering (e.g., hiding the Admin Dashboard link).
2. **Session State (`src/lib/auth.tsx`)**:
   - Manages the active Supabase `Session` and `User`.
   - Fetches and stores the enriched `account` object from the `user_account` table to provide the user's full name, agency ID, and role immediately upon login.
3. **Server State (TanStack Query)**:
   - Used for fetching, caching, and mutating database records. Found in the `src/data/` directory hooks (e.g., `usePipelineDeals`, `useAuditLogs`).

## 4. Directory Structure

```text
/src
  /components
    /admin         # Admin Portal specific components (AdminShell, Charts, Global Config)
    /deal          # Deal & Mandate components (QuickDealModal - EAAB/FICA Mandate Capture & Signed OTP Modal)
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
- **Cloudflare R2 Integration**: We utilize an S3-compatible storage bucket (`cloudflare-r2`) for all sensitive documents (FFCs, FICA documents, Deal PDFs). Files are uploaded with strict path constraints (`<agency_id>/...`).
- **Signed URLs**: Documents are strictly private. The frontend requests signed URLs from Supabase to render PDFs safely in the UI.

## 6. Developer Guidelines

To make ongoing development easier and more predictable, please follow these conventions:

1. **Routing Strategy**: Always use `createFileRoute` provided by `@tanstack/react-router`. Avoid traditional React Router constructs. Keep data loading local to the route or inside a dedicated TanStack Query hook.
2. **Component Granularity**: If a UI chunk exceeds 150 lines inside a Route component, break it out into a sub-component within the same file or move it to `src/components/` if it can be reused.
3. **State Management**: Prefer server-state (TanStack Query) over client-state (Context/Zustand) wherever possible. Only use global state (`useApp`) for purely visual UI states like sidebar toggles.
4. **Forms and Validation**: Standardize on `react-hook-form` and `zod` for all form parsing and validation to guarantee type-safe data reaches the database.
