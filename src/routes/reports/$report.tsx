import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, GlassCard, TableSkeleton } from "@/components/ui-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePipelineDeals } from "@/data/deals";
import { stageFromDb } from "@/lib/domain";
import { dateFmt, zar } from "@/lib/format";

export const Route = createFileRoute("/reports/$report")({ component: ReportPage });

function ReportPage() {
  const { report } = Route.useParams();
  const query = usePipelineDeals();
  const allDeals = query.data ?? [];
  const rows = report === "fall-through" ? allDeals.filter((deal) => !!deal.cancelled) : allDeals;
  const title =
    (
      {
        pipeline: "Pipeline Report",
        "fall-through": "Fall-through Report",
        commission: "Commission Report",
        compliance: "Deal Compliance Report",
      } as Record<string, string>
    )[report] ?? "Deal Report";
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
                <TableHead>Updated</TableHead>
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
                  <TableCell>{dateFmt(deal.stageSince)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </AppShell>
  );
}
