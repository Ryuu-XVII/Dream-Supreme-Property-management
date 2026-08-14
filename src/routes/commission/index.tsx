import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-routing";
import { AppShell } from "@/components/layout/app-shell";
import { CommissionTabs } from "@/components/commission/commission-tabs";
import { CommissionRulesContent } from "@/components/commission/commission-rules-content";

export const Route = createFileRoute("/commission/")({
  head: () => ({ meta: [{ title: "Commission Rules | Dream Supreme Properties" }] }),
  component: CommissionIndex,
});

function CommissionIndex() {
  const { activeAccount } = useAuth();

  if (!canAccessAdmin(activeAccount)) {
    return <Navigate to="/commission/earnings" replace />;
  }

  return (
    <AppShell crumbs={[{ label: "Commission", to: "/commission" }, { label: "Rules" }]}>
      <CommissionTabs />
      <CommissionRulesContent />
    </AppShell>
  );
}
