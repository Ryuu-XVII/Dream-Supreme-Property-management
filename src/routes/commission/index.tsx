import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/commission/")({ component: CommissionIndex });

function CommissionIndex() {
  return <Navigate to="/commission/earnings" replace />;
}
