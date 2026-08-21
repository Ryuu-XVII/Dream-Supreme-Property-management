import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, GlassCard, TableSkeleton } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePipelineDeals, type PipelineDeal } from "@/data/deals";
import { useDashboardData } from "@/data/operations";
import { useDownloadPdfFromTemplate } from "@/data/pdf-generate";
import { stageFromDb } from "@/lib/domain";
import { dateFmt, zar, zarCompact } from "@/lib/format";

export const Route = createFileRoute("/reports/$report")({ component: ReportPage });

const TITLES: Record<string, string> = {
  pipeline: "Pipeline Report",
  "fall-through": "Fall-through Report",
  commission: "Commission Report",
  compliance: "Deal Compliance Report",
};

function ReportPage() {
  const { report } = Route.useParams();
  const title = TITLES[report] ?? "Deal Report";

  if (report === "compliance") {
    return <ComplianceReport title={title} />;
  }
  return <DealReport report={report} title={title} />;
}

function chartFor(report: string, deals: PipelineDeal[]) {
  if (report === "fall-through") {
    const byReason = new Map<string, number>();
    deals
      .filter((d) => !!d.cancelled)
      .forEach((d) => {
        const reason = d.cancelled?.reason || "Other";
        byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
      });
    return Array.from(byReason.entries()).map(([label, count]) => ({ label, value: count }));
  }
  if (report === "commission") {
    const byAgent = new Map<string, number>();
    deals
      .filter((d) => !d.cancelled)
      .forEach((d) => {
        byAgent.set(d.agent.name, (byAgent.get(d.agent.name) ?? 0) + d.grossCommissionCents);
      });
    return Array.from(byAgent.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }
  const byStage = new Map<string, number>();
  deals
    .filter((d) => !d.cancelled)
    .forEach((d) => {
      const stage = stageFromDb[d.stage] ?? d.stage;
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
    });
  return Array.from(byStage.entries()).map(([label, value]) => ({ label, value }));
}

const REPORT_DOCUMENT_TYPES: Record<string, string> = {
  pipeline: "pipeline_report",
  "fall-through": "fallthrough_report",
  commission: "commission_report",
};

function DealReport({ report, title }: { report: string; title: string }) {
  const query = usePipelineDeals();
  const downloadPdf = useDownloadPdfFromTemplate();
  const allDeals = useMemo(() => query.data ?? [], [query.data]);
  const rows = useMemo(
    () =>
      report === "fall-through"
        ? allDeals.filter((deal) => !!deal.cancelled)
        : report === "commission"
          ? [...allDeals]
              .filter((deal) => !deal.cancelled)
              .sort((a, b) => b.grossCommissionCents - a.grossCommissionCents)
          : allDeals,
    [allDeals, report],
  );
  const active = useMemo(
    () =>
      allDeals.filter(
        (deal) =>
          !deal.cancelled && deal.stage !== "registered" && deal.stage !== "commission_released",
      ),
    [allDeals],
  );
  const chartData = useMemo(() => chartFor(report, allDeals), [report, allDeals]);
  const chartLabel =
    report === "fall-through"
      ? "Cancelled deals by reason"
      : report === "commission"
        ? "Gross commission by agent"
        : "Active deals by stage";
  const isCurrencyChart = report === "commission";

  async function downloadPdfClick() {
    const documentType = REPORT_DOCUMENT_TYPES[report];
    if (!documentType) return;
    const generatedOn = dateFmt(new Date().toISOString());
    const inputs: Record<string, string> =
      report === "fall-through"
        ? { generatedOn, totalCancelledDeals: String(rows.length) }
        : report === "commission"
          ? {
              generatedOn,
              totalCommissionExposure: zar(
                rows.reduce((sum, d) => sum + d.grossCommissionCents, 0),
              ),
            }
          : {
              generatedOn,
              totalActiveDeals: String(active.length),
              totalPipelineValue: zar(active.reduce((sum, d) => sum + d.salePrice, 0)),
            };
    try {
      await downloadPdf.mutateAsync({
        documentType,
        inputs,
        chartData,
        filename: `dream-supreme-${report}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the report PDF.");
    }
  }

  return (
    <AppShell
      title={title}
      description="Live database records; export simulations have been removed."
      crumbs={[{ label: "Reports", to: "/reports" }, { label: title }]}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={downloadPdf.isPending}
          onClick={() => void downloadPdfClick()}
        >
          <Download className="size-4" /> {downloadPdf.isPending ? "Generating…" : "Download PDF"}
        </Button>
      }
    >
      {query.isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : query.isError ? (
        <GlassCard>
          <EmptyState
            title="Report unavailable"
            message={query.error instanceof Error ? query.error.message : "Could not load report."}
          />
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard>
          <EmptyState
            title="No matching records"
            message="There is no live data for this report yet."
          />
        </GlassCard>
      ) : (
        <>
          {chartData.length > 0 && (
            <GlassCard className="mb-6">
              <h3 className="font-display text-base font-semibold">{chartLabel}</h3>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-30}
                      dy={12}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10 }}
                      width={isCurrencyChart ? 48 : 28}
                      tickFormatter={isCurrencyChart ? (v) => zarCompact(v) : undefined}
                    />
                    <Tooltip
                      formatter={isCurrencyChart ? (v: number) => zar(v) : undefined}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}
          <GlassCard className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Sale price</TableHead>
                  {report === "commission" ? (
                    <TableHead>Gross commission</TableHead>
                  ) : report === "fall-through" ? (
                    <TableHead>Reason</TableHead>
                  ) : (
                    <TableHead>Updated</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-mono">{deal.ref}</TableCell>
                    <TableCell>{deal.property.address}</TableCell>
                    <TableCell>{stageFromDb[deal.stage] ?? deal.stage}</TableCell>
                    <TableCell>{deal.agent.name}</TableCell>
                    <TableCell>{zar(deal.salePrice)}</TableCell>
                    {report === "commission" ? (
                      <TableCell className="font-medium text-primary">
                        {zar(deal.grossCommissionCents)}
                      </TableCell>
                    ) : report === "fall-through" ? (
                      <TableCell>{deal.cancelled?.reason ?? "—"}</TableCell>
                    ) : (
                      <TableCell>{dateFmt(deal.stageSince)}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </>
      )}
    </AppShell>
  );
}

function statusOf(user: { ffc: { expiry?: string | null } | null }) {
  return !user.ffc
    ? "Missing"
    : !user.ffc.expiry || new Date(user.ffc.expiry) <= new Date()
      ? "Expired"
      : "Valid";
}

function ComplianceReport({ title }: { title: string }) {
  const dashboard = useDashboardData();
  const users = useMemo(() => dashboard.data?.users ?? [], [dashboard.data?.users]);
  const rows = useMemo(
    () =>
      [...users].sort((a, b) => {
        const aExpired = !a.ffc || !a.ffc.expiry || new Date(a.ffc.expiry) <= new Date();
        const bExpired = !b.ffc || !b.ffc.expiry || new Date(b.ffc.expiry) <= new Date();
        return aExpired === bExpired ? 0 : aExpired ? -1 : 1;
      }),
    [users],
  );

  const chartData = useMemo(() => {
    const counts = { Valid: 0, Expired: 0, Missing: 0 };
    rows.forEach((user) => {
      counts[statusOf(user) as keyof typeof counts]++;
    });
    return [
      { label: "Valid", value: counts.Valid, tone: "success" as const },
      { label: "Expired", value: counts.Expired, tone: "danger" as const },
      { label: "Missing", value: counts.Missing, tone: "danger" as const },
    ];
  }, [rows]);

  const downloadPdf = useDownloadPdfFromTemplate();

  async function downloadPdfClick() {
    const validCount = chartData[0].value;
    try {
      await downloadPdf.mutateAsync({
        documentType: "compliance_report",
        inputs: {
          generatedOn: dateFmt(new Date().toISOString()),
          agentsCovered: `${validCount} / ${rows.length}`,
        },
        chartData,
        filename: `dream-supreme-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the report PDF.");
    }
  }

  return (
    <AppShell
      title={title}
      description="Live database records; export simulations have been removed."
      crumbs={[{ label: "Reports", to: "/reports" }, { label: title }]}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={downloadPdf.isPending}
          onClick={() => void downloadPdfClick()}
        >
          <Download className="size-4" /> {downloadPdf.isPending ? "Generating…" : "Download PDF"}
        </Button>
      }
    >
      {dashboard.isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : dashboard.isError ? (
        <GlassCard>
          <EmptyState
            title="Report unavailable"
            message={
              dashboard.error instanceof Error ? dashboard.error.message : "Could not load report."
            }
          />
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard>
          <EmptyState title="No matching records" message="There are no visible users yet." />
        </GlassCard>
      ) : (
        <>
          <GlassCard className="mb-6">
            <h3 className="font-display text-base font-semibold">FFC status breakdown</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={
                          entry.tone === "success"
                            ? "var(--color-success)"
                            : "var(--color-destructive)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
          <GlassCard className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>FFC number</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => {
                  const status = statusOf(user);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell className="font-mono">{user.ffc?.number ?? "—"}</TableCell>
                      <TableCell>{user.ffc?.expiry ? dateFmt(user.ffc.expiry) : "—"}</TableCell>
                      <TableCell>
                        {status === "Valid" ? (
                          <Badge
                            variant="outline"
                            className="border-success/30 bg-success/10 text-success"
                          >
                            Valid
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-destructive/30 bg-destructive/10 text-destructive"
                          >
                            {status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </GlassCard>
        </>
      )}
    </AppShell>
  );
}
