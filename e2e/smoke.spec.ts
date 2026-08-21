import { test, expect } from "@playwright/test";

// Deliberately scoped to public, unauthenticated routes only — not a
// signed-in flow. This app's authenticated paths (login → deal creation →
// commission calculation, the highest-value path for real E2E coverage)
// need a real or seeded Supabase backend to exercise meaningfully; building
// that without a way to run it locally first (this environment has no
// Docker, so `supabase start` can't be verified before pushing) risked
// shipping a CI job nobody could trust was actually testing anything. This
// is a smaller, honestly-scoped starting point — real smoke coverage on
// what doesn't need a backend at all — verified passing locally against the
// Vite dev server before being wired into CI (see playwright.config.ts).

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to Console" })).toBeVisible();
});

test("privacy policy page renders", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});

for (const [path, label] of [
  ["/calculators/bond", "Bond Repayment Calculator"],
  ["/calculators/transfer", "Transfer Cost Calculator"],
  ["/calculators/affordability", "Bond Affordability Calculator"],
  ["/calculators/yield", "Rental Yield Calculator"],
] as const) {
  test(`${label} loads and links a privacy policy`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: label })).toBeVisible();
    // POPIA consent gate on the lead-capture form (see the "Email My
    // Results" dialog in calculator-shell.tsx) depends on this link
    // existing and pointing at a real route — worth a smoke assertion
    // since it's a compliance requirement, not just UI.
    await expect(page.getByRole("link", { name: "Privacy Policy" }).first()).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
}
