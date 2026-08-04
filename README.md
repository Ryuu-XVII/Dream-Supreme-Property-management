# Dream Supreme Property Management

> **Live Portals**:
> - 🏢 **Agent Portal**: [https://dream-supreme-property-management.vercel.app](https://dream-supreme-property-management.vercel.app)
> - 🛡️ **Admin Portal**: [https://admin-dreamsupreme.vercel.app](https://admin-dreamsupreme.vercel.app)

Welcome to the **Dream Supreme** internal operations platform.

Dream Supreme is a modern, next-generation web application designed to handle the end-to-end lifecycle of South African real estate operations. It operates as a secure, multi-tenant portal that enables property practitioners, principals, admins, and conveyancing attorneys to collaborate seamlessly.

## 🌟 Core Modules & Capabilities

The platform is designed to replace fragmented spreadsheets and legacy CRMs by centralizing:

1. **Sales & Deal Workflows**
   - Track properties from initial Mandate to Registered Deal.
   - Manage Suspensive Conditions, OTPs, and strict stage transitions.
   - Live Countdown Boards to monitor deal expiries.

2. **Rentals Management (Release 2)**
   - Dedicated dashboard for active lease agreements.
   - Integrated financial ledger tracking monthly invoices, utilities, and deposits.
   - Maintenance ticket logging and status tracking.
   - Strict read/write access limited to the designated `managed_by` rental agent.

3. **Commission Engine**
   - Automated, rule-based commission splits based on agency defaults or agent-specific overrides.
   - Automated clawbacks and recalculations for canceled deals.
   - **Compliance Blockers:** The engine automatically halts payouts if participating agents lack valid Fidelity Fund Certificates (FFC).

4. **Conveyancer Portal**
   - External attorneys do not require portal accounts.
   - They receive secure, single-use, time-expiring "magic links" to update deal statuses (e.g., Lodged, Registered) directly into the agency's database.

5. **Document & Compliance Management**
   - Secure Cloudflare R2 object storage integration for FICA documents, FFCs, and Deal PDFs.
   - Scheduled daily background sweeps (`pg_cron`) automatically audit and suspend agent accounts if their FFC expires.

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 18, Vite, TypeScript
- **Routing & State:** `@tanstack/react-router` (file-based routing), `@tanstack/react-query` (server state)
- **Styling:** Tailwind CSS, `shadcn/ui`, Framer Motion (animations)
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Security:** Strict PostgreSQL Row Level Security (RLS) handles all data isolation. The UI uses `<AuthGuard>` for routing, but true security is enforced at the database level.

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

### 3. Start Local Supabase

This will boot up the local PostgreSQL database, Auth server, and Storage bucket via Docker.

```bash
npx supabase start
```

_Note: Copy the API URL and anon key printed by this command into your `.env.local` file. The application will not start without them._

### 4. Apply Database Migrations & Seed Data

```bash
npx supabase db reset
```

### 5. Run the Application

```bash
npm run dev
```

### 6. Verify Code Quality

To run the complete verification suite (TypeScript, ESLint, Vitest, and a test build):

```bash
npm run check
```

---

## 🔐 First Principal Bootstrap

Because Dream Supreme is an invitation-only enterprise platform, you cannot simply "sign up" from the UI.

For a brand new installation:

1. Ensure all migrations are applied.
2. Create the first principal user in your Supabase Auth dashboard.
3. From a trusted server using the Supabase `service_role` key, invoke the `bootstrap_principal` RPC function with the agency slug, Auth user UUID, matching email, and full name.
4. Sign into the application as that principal. You can now invite all subsequent agents and admins from **Settings > Users**.

_(Never expose the `service_role` key to this Vite application. The bootstrap function permanently refuses to run once an agency has an active principal)._

---

## 🌍 Production Deployment

Deploying this platform requires configuring the infrastructure outside of the repository:

1. Provision a production Supabase project (configure Auth URLs, SMTP, and Cloudflare R2).
2. Apply migrations (`npx supabase db push`).
3. Inject the production `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_PUBLIC_AGENCY_SLUG` into the CI/CD pipeline environment.
4. Build the application (`npm ci && npm run check`).
5. Deploy the output `dist/` directory behind an HTTPS host (e.g., using the provided `Dockerfile` and `nginx.conf`).
6. Schedule the daily trusted call to `run_daily_sweeps()` using a worker or cron job to maintain automated compliance enforcement.
