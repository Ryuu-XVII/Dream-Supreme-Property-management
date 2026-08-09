# Local Development & DevOps Setup

This document explains how to set up the Dream Supreme codebase on your local machine for development, testing, and deployment.

## Prerequisites

- **Node.js** (v18+)
- **Docker Desktop** (Required for the local Supabase stack)
- **Git**

## 1. Local Supabase Backend

We use the Supabase CLI to run a full instance of our Postgres database, Auth, and Storage locally. This ensures your development environment perfectly matches production.

1. Ensure Docker Desktop is running.
2. Initialize and start the local Supabase stack:
   ```bash
   npx supabase start
   ```
3. The CLI will output local URLs and Keys (e.g., `API URL`, `anon key`, `service_role key`).
4. To apply the latest migrations to your local database, run:
   ```bash
   npx supabase db push
   ```
5. To load seed data (including the master admin account), run:
   ```bash
   npx supabase db reset
   ```

## 2. Frontend Environment

The frontend is built with React, Vite, and TanStack Router.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with the keys outputted by `supabase start`.
   - `VITE_SUPABASE_URL=http://127.0.0.1:54321`
   - `VITE_SUPABASE_ANON_KEY=...`
4. Start the development server:
   ```bash
   npm run dev
   ```

## 3. Pre-Commit Safety Checks

We enforce strict quality control. Before pushing code, you must ensure it passes our automated checks.
```bash
npm run check
```
This runs TypeScript (`tsc`), ESLint, and our test suite. You cannot merge code if this check fails.

## 4. Deployment

Our application is deployed via automated CI/CD pipelines. Pushing to the `main` branch will trigger a production build. The pipeline will automatically run `supabase db push` to apply any new database schema migrations to the remote production database.
