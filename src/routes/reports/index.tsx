import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Download, GitBranch, ShieldCheck, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, GlassCard, KpiCard } from "@/components/ui-kit";
import { useDashboardData } from "@/data/operations";
import { STAGES } from "@/types";
import { zarCompact } from "@/lib/format";
import { generateReportPdf } from "@/lib/report-pdf";

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

const shortStage: Record<string, string> = {
  "Mandate Signed": "Mandate",
  "Listed/Marketing": "Listed",
  "Offer Received": "Offer",
  "OTP Signed": "OTP",
  "Conditions Pending": "Conditions",
  "Conveyancer Instructed": "Conveyancer",
  "Compliance Certs": "Compliance",
  "Transfer Duty": "Duty",
  "Rates & Levy Clearance": "Clearance",
  "Documents & Guarantees": "Docs",
  Lodged: "Lodged",
  Registered: "Registered",
  "Commission Released": "Paid",
};

function ReportsHub() {
  const dashboard = useDashboardData();
  const deals = useMemo(() => dashboard.data?.deals ?? [], [dashboard.data?.deals]);
  const users = useMemo(() => dashboard.data?.users ?? [], [dashboard.data?.users]);
  const active = useMemo(
    () =>
      deals.filter(
        (deal) =>
          !deal.cancelled && deal.stage !== "Registered" && deal.stage !== "Commission Released",
      ),
    [deals],
  );
  const pipelineValue = useMemo(
    () => active.reduce((sum, deal) => sum + deal.salePrice, 0),
    [active],
  );
  const cancelled = useMemo(() => deals.filter((deal) => !!deal.cancelled).length, [deals]);
  const ffcIssues = useMemo(
    () =>
      users.filter(
        (user) => !user.ffc || !user.ffc.expiry || new Date(user.ffc.expiry) <= new Date(),
      ).length,
    [users],
  );

  const stageCounts = useMemo(
    () =>
      STAGES.map((s) => ({
        stage: shortStage[s] ?? s,
        count: deals.filter((deal) => deal.stage === s && !deal.cancelled).length,
      })),
    [deals],
  );

  function downloadPdf() {
    generateReportPdf({
      title: "Reports Overview",
      subtitle: "Agency-wide summary",
      filename: `dream-supreme-reports-overview-${new Date().toISOString().slice(0, 10)}.pdf`,
      kpis: [
        { label: "Active deals", value: String(active.length) },
        { label: "Pipeline value", value: zarCompact(pipelineValue) },
        {
          label: "FFC issues",
          value: String(ffcIssues),
          tone: ffcIssues ? "danger" : "success",
        },
      ],
      chart: {
        title: "Active deals by stage",
        series: stageCounts.map((s) => ({ label: s.stage, value: s.count })),
      },
      table: {
        columns: ["Report", "Summary"],
        rows: REPORT_CARDS.map((c) => [
          c.title,
          c.key === "fall-through" ? `${cancelled} cancelled deals` : c.description,
        ]),
      },
    });
  }

  return (
    <AppShell
      title="Reports"
      description="Reports calculated from live agency records."
      actions={
        <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadPdf}>
          <Download className="size-4" /> Download PDF
        </Button>
      }
    >
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
        <>
          <GlassCard className="mt-6">
            <h3 className="font-display text-base font-semibold">Active deals by stage</h3>
            <p className="text-xs text-muted-foreground">Live pipeline distribution</p>
            {dashboard.isLoading ? (
              <div className="mt-4 h-56 animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageCounts} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="stage"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-30}
                      dy={12}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>

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
        </>
      )}
    </AppShell>
  );
}
