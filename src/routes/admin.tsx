import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-routing";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { activeAccount, loading } = useAuth();
  const isAllowed = canAccessAdmin(activeAccount);

  if (loading) return null;

  if (!isAllowed) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
