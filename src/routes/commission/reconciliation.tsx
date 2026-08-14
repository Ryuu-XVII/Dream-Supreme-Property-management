import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-routing";
import { AppShell } from "@/components/layout/app-shell";
import { CommissionTabs } from "@/components/commission/commission-tabs";
import { ReconciliationContent } from "@/components/commission/reconciliation-content";

export const Route = createFileRoute("/commission/reconciliation")({
  head: () => ({ meta: [{ title: "Monthly Reconciliation | Dream Supreme Properties" }] }),
  component: ReconciliationRoute,
});

function ReconciliationRoute() {
  const { activeAccount } = useAuth();

  if (!canAccessAdmin(activeAccount)) {
    return <Navigate to="/commission/earnings" replace />;
  }

  return (
    <AppShell crumbs={[{ label: "Commission", to: "/commission" }, { label: "Reconciliation" }]}>
      <CommissionTabs />
      <ReconciliationContent />
    </AppShell>
  );
}
