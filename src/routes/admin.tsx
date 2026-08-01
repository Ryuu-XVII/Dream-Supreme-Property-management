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

  const isAllowed = account && (account.role === "principal" || account.role === "admin");

  useEffect(() => {
    if (!loading && !isAllowed) {
      toast.error("Access denied: Administrative privileges required.");
    }
  }, [loading, isAllowed]);

  if (loading) return null;

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
