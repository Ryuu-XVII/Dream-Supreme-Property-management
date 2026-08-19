import type { UserAccount } from "./auth";

const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/reset-password",
  "/register",
  "/calculators",
  "/conveyancer",
  "/sign",
  "/privacy",
] as const;

export function isPublicPathname(pathname: string): boolean {
  if (pathname === "/sitemap.xml") return true;

  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isActiveAccount(account: UserAccount | null): account is UserAccount {
  return account?.status === "active";
}

export function isAdminDomain(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  const origin = window.location.origin;

  return (
    hostname.startsWith("admin.") ||
    hostname.startsWith("admin-") ||
    hostname === "admin.localhost" ||
    (import.meta.env.VITE_ADMIN_DOMAIN &&
      (origin === import.meta.env.VITE_ADMIN_DOMAIN ||
        hostname === import.meta.env.VITE_ADMIN_DOMAIN))
  );
}

export function canAccessAdmin(account: UserAccount | null): boolean {
  if (!account || !isActiveAccount(account)) return false;
  const role = (account.role || "").toLowerCase();
  return role.includes("admin");
}
