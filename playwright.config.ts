import { defineConfig, devices } from "@playwright/test";

// Deliberately scoped to public, unauthenticated routes only — see
// e2e/smoke.spec.ts for why. Runs against the Vite dev server (no build
// step needed) with the same placeholder Supabase credentials CI's unit
// test job already uses (.github/workflows/ci.yml), so the app boots
// without needing a real backend.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: "https://placeholder-domain.supabase.co",
      VITE_SUPABASE_ANON_KEY: "placeholder-anon-key-for-testing",
    },
  },
});
