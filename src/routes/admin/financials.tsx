import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatisticsChart } from "@/components/admin/statistics-chart";
import { GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/admin/financials")({
  component: AdminFinancials,
});

function AdminFinancials() {
  return (
    <>
      <AdminPageHeader
        title="Financials"
        description="Track income, expenses, and financial reporting."
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <StatisticsChart />
        </div>
        <GlassCard>
          <p className="text-muted-foreground">Detailed financial reporting coming soon...</p>
        </GlassCard>
      </div>
    </>
  );
}
