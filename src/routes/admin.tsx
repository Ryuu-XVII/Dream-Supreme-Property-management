import { useEffect } from "react";
import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-routing";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { account, impersonatedAccount, stopImpersonating, loading } = useAuth();

  // Only clear impersonation on mount (e.g. an admin navigates back into
  // /admin while still impersonating someone). Must NOT re-run on every
  // change to impersonatedAccount, otherwise clicking "View Portal" from
  // within /admin/users clears the impersonation it just started before the
  // resulting navigate({ to: "/" }) has a chance to leave this layout.
  useEffect(() => {
    if (impersonatedAccount) {
      stopImpersonating();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAllowed = canAccessAdmin(account);

  if (loading && !account) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading admin portal…
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({account?.email || "Unknown"}) is registered as an Agent and does not have
            Admin Portal access.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Sign in with another account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
