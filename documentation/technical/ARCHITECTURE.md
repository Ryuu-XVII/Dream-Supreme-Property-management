# System Architecture & Design

This document outlines the core architecture of the Dream Supreme Property Management application.

## 1. Technology Stack
- **Frontend Framework**: React 18, Vite, TypeScript
- **Routing**: `@tanstack/react-router` (File-based routing)
- **Data Fetching/Caching**: `@tanstack/react-query`
- **Styling**: Tailwind CSS, `lucide-react` (icons), `framer-motion` (animations), `shadcn/ui` (accessible components)
- **Backend / Database**: Supabase (PostgreSQL, Auth, RLS)

## 2. Portal Separation (RBAC)
The application operates as a **Monolith with Subdirectory Routing**, serving two distinct portals based on the user's authenticated role (`Principal`, `Admin`, `Agent`, `Candidate`):

- **Agent Portal (Main App)**: Resides in the root (`/`, `/deals`, `/pipeline`, `/leads`). Wrapped by `<AppShell>` which includes the main sidebar and header. Restricted to Agents, Candidates, and Principals.
- **Admin Portal**: Resides under `/admin/*`. Wrapped by `<AdminShell>` with its own dedicated sidebar and header. Restricted strictly to Admins and Principals. 

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
    /admin         # Admin Portal specific components (AdminShell, Charts, Headers)
    /deal          # Deal-specific components (QuickDealModal)
    /layout        # Main Agent Portal shell (AppShell, Sidebar, Header)
    /ui            # Shadcn UI primitives (Buttons, Inputs, Dialogs)
  /data            # TanStack Query hooks and mock data fallbacks
  /lib             # Core utilities (Auth, Supabase client, Formatting, State)
  /routes          # TanStack Router file-based route definitions
    __root.tsx     # Root context and AuthGuard enforcement
    /admin         # Admin Portal routes
    /deals         # Agent Portal deal routes
/supabase
  /migrations      # PostgreSQL schema, functions, and RLS policies
```

## 5. Security Principles
- **Never Trust the Client**: While `AuthGuard` handles UI routing, true data security is enforced at the database layer using Postgres Row Level Security (RLS). Even if a user bypasses the UI blocks, Supabase will reject queries they are not authorized for.
- **No Shared Secrets**: The application only ships with the `VITE_SUPABASE_ANON_KEY`, relying strictly on JWTs for authorization.
