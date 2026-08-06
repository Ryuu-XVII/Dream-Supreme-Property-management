import { createFileRoute } from "@tanstack/react-router";
import { Calculator, Home, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CommissionTabs } from "@/components/commission/commission-tabs";
import { EmptyState, GlassCard, KpiCard, TableSkeleton } from "@/components/ui-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMyEarnings } from "@/data/deals";
import { dateFmt, zar } from "@/lib/format";

export const Route = createFileRoute("/commission/earnings")({
  head: () => ({ meta: [{ title: "Agent Earnings | Dream Supreme Properties" }] }),
  component: EarningsPage,
});

function EarningsPage() {
  const query = useMyEarnings();
  const data = query.data;
  return (
    <AppShell
      title="Agent Earnings"
      description={`Year-to-date commission earnings for ${data?.agentName ?? "the signed-in practitioner"}.`}
      crumbs={[{ label: "Commission", to: "/commission" }, { label: "Earnings" }]}
    >
      <CommissionTabs />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="YTD earnings" value={zar(data?.ytdEarnings ?? 0)} icon={Wallet} />
        <KpiCard
          label="Pending pipeline"
          value={zar(data?.pendingPipeline ?? 0)}
          icon={Home}
          tone="warning"
        />
        <KpiCard label="Average per deal" value={zar(data?.avgPerDeal ?? 0)} icon={Calculator} />
      </div>
      <GlassCard>
        <h2 className="mb-4 font-display text-lg font-semibold">Deal breakdown</h2>
        {query.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : query.isError ? (
          <EmptyState
            title="Earnings unavailable"
            message={
              query.error instanceof Error ? query.error.message : "Could not load earnings."
            }
          />
        ) : (data?.dealRows.length ?? 0) === 0 ? (
          <EmptyState
            title="No commission records"
            message="Registered deal allocations will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Sale price</TableHead>
                  <TableHead>Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.dealRows.map((row: any) => (
                  <TableRow key={row.deal.id}>
                    <TableCell>
                      {row.deal.registeredAt ? dateFmt(row.deal.registeredAt) : "—"}
                    </TableCell>
                    <TableCell>{row.property?.address ?? "—"}</TableCell>
                    <TableCell>{zar(row.deal.salePrice ?? 0)}</TableCell>
                    <TableCell className="font-semibold">{zar(row.commission ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </AppShell>
  );
}
