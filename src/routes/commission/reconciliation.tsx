import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/commission/reconciliation")({
  component: ReconciliationRoute,
});

function ReconciliationRoute() {
  const { activeAccount } = useAuth();
  return (
    <Navigate
      to={activeAccount?.role === "admin" ? "/admin/recon" : "/commission/earnings"}
      replace
    />
  );
}
