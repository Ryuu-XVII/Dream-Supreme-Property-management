import { createFileRoute } from "@tanstack/react-router";
import { Building2, FileText, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminDealsPipeline } from "@/components/admin/admin-deals-pipeline";
import { EmptyState, GlassCard, KpiCard } from "@/components/ui-kit";
import { useDashboardData } from "@/data/operations";
import { relative } from "@/lib/format";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const dashboard = useDashboardData();
  const data = dashboard.data;
  const propertyCount = new Set((data?.deals ?? []).map((deal) => deal.propertyId).filter(Boolean))
    .size;
  return (
    <>
      <AdminPageHeader title="Admin Home" description="Live system overview and administration." />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Visible users"
            value={data?.users.length ?? 0}
            sub="Agency accounts"
            icon={Users}
          />
          <KpiCard
            label="Deal properties"
            value={propertyCount}
            sub="Properties attached to deals"
            icon={Building2}
          />
          <KpiCard
            label="Total deals"
            value={data?.deals.length ?? 0}
            sub="Visible agency deals"
            icon={FileText}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminDealsPipeline />
          <GlassCard>
            <h3 className="font-display text-base font-semibold">Recent activity</h3>
            <p className="mb-4 text-xs text-muted-foreground">Latest persisted audit events</p>
            {dashboard.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (data?.auditEvents.length ?? 0) === 0 ? (
              <EmptyState
                title="No recent activity"
                message="Persisted agency actions will appear here."
              />
            ) : (
              <div className="space-y-3">
                {data?.auditEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-medium">{event.summary}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relative(event.at)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.user} · {event.entityType}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </>
  );
}
