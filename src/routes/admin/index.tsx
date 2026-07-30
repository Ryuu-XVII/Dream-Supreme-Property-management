import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminDealsPipeline } from "@/components/admin/admin-deals-pipeline";
import { GlassCard, KpiCard } from "@/components/ui-kit";
import { Users, Building2, FileText, Plus, ShieldAlert, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <>
      <AdminPageHeader title="Admin Home" description="System overview and administration." />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-3">
          <KpiCard
            label="Total Agents"
            value={142}
            trend={12}
            sub="Active accounts"
            icon={Users}
            delay={0}
          />
          <KpiCard
            label="Properties"
            value={384}
            trend={4}
            sub="Active listings"
            icon={Building2}
            delay={0.05}
          />
          <KpiCard
            label="Total Deals"
            value={89}
            trend={8}
            sub="In progress"
            icon={FileText}
            delay={0.1}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-1">
            <AdminDealsPipeline />
          </div>
          <GlassCard className="lg:col-span-1">
            <h3 className="font-display text-base font-semibold">Recent Activity</h3>
            <p className="text-xs text-muted-foreground mb-4">Latest system events</p>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="size-2 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Agent logged in</p>
                      <span className="text-xs text-muted-foreground">{i}h ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Jane Doe accessed the system from Capetown, ZA
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
