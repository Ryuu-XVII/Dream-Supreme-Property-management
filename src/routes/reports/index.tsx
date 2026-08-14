import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, GitBranch, ShieldCheck, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, GlassCard, KpiCard } from "@/components/ui-kit";
import { useDashboardData } from "@/data/operations";
import { zarCompact } from "@/lib/format";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "Reports | Dream Supreme Properties" }] }),
  component: ReportsHub,
});

const REPORT_CARDS = [
  {
    key: "pipeline",
    title: "Pipeline",
    description: "Live active deals by stage and value.",
    icon: GitBranch,
  },
  {
    key: "fall-through",
    title: "Fall-through",
    description: "Cancelled deals and recorded reasons.",
    icon: BarChart3,
  },
  {
    key: "commission",
    title: "Commission",
    description: "Live deal commission exposure.",
    icon: Wallet,
  },
  {
    key: "compliance",
    title: "Compliance",
    description: "Current FFC coverage across visible users.",
    icon: ShieldCheck,
  },
];

function ReportsHub() {
  const dashboard = useDashboardData();
  const deals = dashboard.data?.deals ?? [];
  const users = dashboard.data?.users ?? [];
  const active = deals.filter(
    (deal) =>
      !deal.cancelled && deal.stage !== "Registered" && deal.stage !== "Commission Released",
  );
  const pipelineValue = active.reduce((sum, deal) => sum + deal.salePrice, 0);
  const cancelled = deals.filter((deal) => !!deal.cancelled).length;
  const ffcIssues = users.filter(
    (user) => !user.ffc || !user.ffc.expiry || new Date(user.ffc.expiry) <= new Date(),
  ).length;
  return (
    <AppShell title="Reports" description="Reports calculated from live agency records.">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active deals" value={active.length} icon={GitBranch} />
        <KpiCard label="Pipeline value" value={zarCompact(pipelineValue)} icon={Wallet} />
        <KpiCard
          label="FFC issues"
          value={ffcIssues}
          icon={ShieldCheck}
          tone={ffcIssues ? "danger" : "success"}
        />
      </div>
      {dashboard.isError ? (
        <GlassCard className="mt-6">
          <EmptyState
            title="Reports unavailable"
            message={
              dashboard.error instanceof Error
                ? dashboard.error.message
                : "Could not load report data."
            }
          />
        </GlassCard>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {REPORT_CARDS.map(({ key, title, description, icon: Icon }) => (
            <Link key={key} to="/reports/$report" params={{ report: key }}>
              <GlassCard className="h-full transition-colors hover:border-primary/40">
                <Icon className="size-5 text-primary" />
                <h2 className="mt-3 font-display font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                {key === "fall-through" && (
                  <p className="mt-3 text-sm font-medium">{cancelled} cancelled deals</p>
                )}
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
