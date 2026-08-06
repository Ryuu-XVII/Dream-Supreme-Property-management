import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/financials")({ component: FinancialsRoute });

function FinancialsRoute() {
  return <Navigate to="/admin/recon" replace />;
}
