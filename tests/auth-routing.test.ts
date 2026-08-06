import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessAdmin, isActiveAccount, isPublicPathname } from "@/lib/auth-routing";
import type { UserAccount } from "@/lib/auth";

function account(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    id: "user-1",
    agencyId: "agency-1",
    branchId: null,
    fullName: "Test User",
    email: "user@example.com",
    role: "agent",
    status: "active",
    ...overrides,
  };
}

describe("authentication route policy", () => {
  it.each([
    "/login",
    "/reset-password",
    "/register",
    "/calculators/bond",
    "/conveyancer",
    "/sign",
    "/sitemap.xml",
  ])("keeps the intended public route available: %s", (pathname) => {
    expect(isPublicPathname(pathname)).toBe(true);
  });

  it.each(["/", "/pipeline", "/admin", "/login-impersonation", "/signatures"])(
    "protects non-public routes: %s",
    (pathname) => {
      expect(isPublicPathname(pathname)).toBe(false);
    },
  );

  it("requires an active account", () => {
    expect(isActiveAccount(account())).toBe(true);
    expect(isActiveAccount(account({ status: "suspended" }))).toBe(false);
    expect(isActiveAccount(account({ status: "archived" }))).toBe(false);
    expect(isActiveAccount(null)).toBe(false);
  });

  it("limits admin routes to active administrators and principals", () => {
    expect(canAccessAdmin(account({ role: "admin" }))).toBe(true);
    expect(canAccessAdmin(account({ role: "principal" }))).toBe(true);
    expect(canAccessAdmin(account({ role: "agent" }))).toBe(false);
    expect(canAccessAdmin(account({ role: "admin", status: "suspended" }))).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
  });
});

describe("authentication wiring regression", () => {
  const root = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
  const login = readFileSync(join(process.cwd(), "src/routes/login.tsx"), "utf8");
  const resetPassword = readFileSync(join(process.cwd(), "src/routes/reset-password.tsx"), "utf8");

  it("mounts the authentication provider around protected content", () => {
    expect(root).toContain("<AuthProvider>");
    expect(root).toContain("<AuthenticatedOutlet />");
  });

  it("uses Supabase password authentication without a hard-coded demo code", () => {
    expect(login).toContain("supabase.auth.signInWithPassword");
    expect(login).not.toContain("Demo code:");
    expect(login).not.toContain('otp === "123456"');
  });

  it("requires a Supabase recovery event before accepting a replacement password", () => {
    expect(resetPassword).toContain("passwordRecovery");
    expect(resetPassword).toContain("!session || !passwordRecovery");
  });
});
