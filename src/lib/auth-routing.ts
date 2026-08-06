import type { UserAccount } from "./auth";

const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/reset-password",
  "/register",
  "/calculators",
  "/conveyancer",
  "/sign",
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

export function canAccessAdmin(account: UserAccount | null): boolean {
  return isActiveAccount(account) && (account.role === "admin" || account.role === "principal");
}
