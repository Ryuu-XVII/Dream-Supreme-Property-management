import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { account, loading } = useAuth();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isAdminDomain =
    hostname.startsWith("admin.") ||
    hostname.startsWith("admin-") ||
    hostname === "admin.localhost" ||
    (import.meta.env.VITE_ADMIN_DOMAIN &&
      (window.location.origin === import.meta.env.VITE_ADMIN_DOMAIN ||
        window.location.hostname === import.meta.env.VITE_ADMIN_DOMAIN));

  const isAllowed =
    isAdminDomain || (account && (account.role === "principal" || account.role === "admin"));

  useEffect(() => {
    if (!loading && !isAllowed) {
      toast.error("Access denied: Administrative privileges required.");
    }
  }, [loading, isAllowed]);

  if (loading && !isAdminDomain) return null;

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
