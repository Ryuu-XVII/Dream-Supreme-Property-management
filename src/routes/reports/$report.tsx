import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
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
import { usePipelineDeals } from "@/data/deals";
import { useDashboardData } from "@/data/operations";
import { stageFromDb } from "@/lib/domain";
import { dateFmt, zar } from "@/lib/format";

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

function DealReport({ report, title }: { report: string; title: string }) {
  const query = usePipelineDeals();
  const allDeals = query.data ?? [];
  const rows =
    report === "fall-through"
      ? allDeals.filter((deal) => !!deal.cancelled)
      : report === "commission"
        ? [...allDeals]
            .filter((deal) => !deal.cancelled)
            .sort((a, b) => b.grossCommissionCents - a.grossCommissionCents)
        : allDeals;

  return (
    <AppShell
      title={title}
      description="Live database records; export simulations have been removed."
      crumbs={[{ label: "Reports", to: "/reports" }, { label: title }]}
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
      )}
    </AppShell>
  );
}

function ComplianceReport({ title }: { title: string }) {
  const dashboard = useDashboardData();
  const users = dashboard.data?.users ?? [];
  const rows = [...users].sort((a, b) => {
    const aExpired = !a.ffc || !a.ffc.expiry || new Date(a.ffc.expiry) <= new Date();
    const bExpired = !b.ffc || !b.ffc.expiry || new Date(b.ffc.expiry) <= new Date();
    return aExpired === bExpired ? 0 : aExpired ? -1 : 1;
  });

  return (
    <AppShell
      title={title}
      description="Live database records; export simulations have been removed."
      crumbs={[{ label: "Reports", to: "/reports" }, { label: title }]}
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
                const expired =
                  !user.ffc || !user.ffc.expiry || new Date(user.ffc.expiry) <= new Date();
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell className="font-mono">{user.ffc?.number ?? "—"}</TableCell>
                    <TableCell>{user.ffc?.expiry ? dateFmt(user.ffc.expiry) : "—"}</TableCell>
                    <TableCell>
                      {expired ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/30 bg-destructive/10 text-destructive"
                        >
                          {user.ffc ? "Expired" : "Missing"}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 text-success"
                        >
                          Valid
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </AppShell>
  );
}
