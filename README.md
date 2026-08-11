# Dream Supreme Property Management

> **Live Portals**:
>
> - 🏢 **Agent Portal**: [https://dream-supreme-property-management.vercel.app](https://dream-supreme-property-management.vercel.app)
> - 🛡️ **Admin Portal**: [https://admin-dreamsupreme.vercel.app](https://admin-dreamsupreme.vercel.app)

Welcome to the **Dream Supreme** internal operations platform.

Dream Supreme is a modern, next-generation web application designed to handle the end-to-end lifecycle of South African real estate operations. It operates as a secure, multi-tenant portal that enables property practitioners, principals, admins, and conveyancing attorneys to collaborate seamlessly.

---

## 🌟 Core Modules & Capabilities

The platform is designed to replace fragmented spreadsheets and legacy CRMs by centralizing:

### 1. Sales & Deal Workflows

- Track properties from initial Mandate to Registered Deal.
- Manage Suspensive Conditions, OTPs, and strict stage transitions.
- **60-Second Express Deal Capture** modal for rapid agent pipeline entry.
- Live Countdown Boards to monitor deal expiries.

### 2. Cloudflare R2 Object Storage & Agent Quotas

- Per-agent isolated storage namespaces (`users/<user_id>/...`).
- Database session & role authorization checks (`verifyStorageAccessAuthorization`) protecting documents against unauthorized access.
- Global per-agent storage allocation enforcement (1 GB default) with interactive Admin quota override controls.

### 3. System Settings & Governance Hub (`/admin/settings`)

- **General & Health**: Real-time DB latency diagnostics, R2 ping test, and infrastructure status badges.
- **Storage & R2 Governance**: Bucket parameters (`dream-supreme-documents`), presigned URL policies, and agent quota configuration.
- **Security & Access**: Idle session timeout rules, MFA enforcement, registration approval policies, and allowed domain filters (`dreamsupreme.co.za`).
- **Notification & Gateway Status**: Automated event dispatchers and dynamic integration status checks (WhatsApp, Auth Mailer, Conveyancer Webhooks, Xero/Sage Sync).
- **Automated Maintenance**: Configurable retention thresholds for deal archival, idle agent deactivation, and recycle bin purging.

### 4. Commission Engine

- Automated, rule-based commission splits based on agency defaults or agent-specific overrides.
- Automated clawbacks and recalculations for canceled deals.
- **Compliance Blockers:** The engine automatically halts payouts if participating agents lack valid Fidelity Fund Certificates (FFC).

### 5. Conveyancer Portal

- External attorneys receive secure, single-use, time-expiring "magic links" to update deal statuses (e.g., Lodged, Registered) directly into the agency's database.

### 6. Rentals Management

- Dedicated dashboard for active lease agreements.
- Financial ledger tracking monthly invoices, utilities, and deposits.
- Maintenance ticket logging with photo attachment support.

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 18, Vite 8, TypeScript
- **Routing & State:** `@tanstack/react-router` (file-based routing), `@tanstack/react-query` (server state)
- **Styling:** Tailwind CSS, `shadcn/ui`, Framer Motion (animations)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Storage:** Cloudflare R2 S3 Object Storage API (with Supabase Storage fallback)
- **Security:** Strict PostgreSQL Row Level Security (RLS) handles all data isolation. The UI uses `<AuthGuard>` for routing, with database-layer session authorization.

---

## 🚀 Local Development Setup

To run this project locally, you will need **Node.js 22+**, **npm**, the **Supabase CLI**, and **Docker Desktop**.

### 1. Install Dependencies

```bash
npm ci
```

### 2. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Ensure your `.env.local` includes your Supabase and Cloudflare R2 credentials:

```env
VITE_SUPABASE_URL=https://qlupnjrprvihlmtxplmo.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_R2_ACCOUNT_ID="c831ffacd8d317ac8342a1cebfcf914a"
VITE_R2_ACCESS_KEY_ID="your_r2_access_key"
VITE_R2_SECRET_ACCESS_KEY="your_r2_secret_key"
VITE_R2_BUCKET_NAME="dream-supreme-documents"
```

### 3. Start Local Supabase

```bash
npx supabase start
```

### 4. Apply Database Migrations & Seed Data

```bash
npx supabase db reset
```

### 5. Run the Application

```bash
npm run dev
```

### 6. Run Full Pre-Commit Check

Before committing or pushing code, run the mandatory check:

```bash
npm run check
```

---

## 🔐 Authentication & Security

Dream Supreme is an invitation-only enterprise platform:

1. **Master Admin & Agent Auth**: Passwords are authenticated via Supabase Auth with bcrypt/JWT claims.
2. **Show Password Option**: Login screen supports interactive password visibility toggling.
3. **Database RLS**: Multi-tenant database isolation ensures users only see data belonging to their agency.
4. **Storage Authorization**: File downloads require an active authenticated session matching the agent's user path.

---

## 🌍 Repository & Remote

- **GitHub Repository**: [https://github.com/Ryuu-XVII/Dream-Supreme-Property-management](https://github.com/Ryuu-XVII/Dream-Supreme-Property-management)
- **Primary Branch**: `main`
