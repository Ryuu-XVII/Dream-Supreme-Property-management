import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, FileText, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CommissionTabs } from "@/components/commission/commission-tabs";
import { GlassCard, EmptyState, TableSkeleton, useFakeLoad } from "@/components/ui-kit";
import { AgentAvatar } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deals,
  propertyById,
  userById,
  grossCommission,
  netPayable,
  ruleSets,
  VAT_RATE,
} from "@/data/state";
import { useCan } from "@/lib/app-state";
import { dateFmt, zar } from "@/lib/format";

export const Route = createFileRoute("/commission/reconciliation")({
  head: () => ({
    meta: [
      { title: "Monthly Commission Reconciliation | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Reconcile registered deals, practitioner payouts and clawbacks for each commission run.",
      },
      {
        property: "og:title",
        content: "Monthly Commission Reconciliation | Dream Supreme Properties",
      },
      {
        property: "og:description",
        content:
          "Reconcile registered deals, practitioner payouts and clawbacks for each commission run.",
      },
    ],
  }),
  component: ReconciliationPage,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type RunStatus = "Not Started" | "Draft" | "Approved";

function ReconciliationPage() {
  const loading = useFakeLoad(500);
  const can = useCan("commission.approve");
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [statusByPeriod, setStatusByPeriod] = useState<Record<string, RunStatus>>({});

  const key = `${period.year}-${period.month}`;
  // derive a deterministic "default" status from data: current month with registered deals = Draft, else Not Started
  const registeredDeals = useMemo(
    () =>
      deals.filter((d) => {
        if (!d.registeredAt) return false;
        const rd = new Date(d.registeredAt);
        return rd.getMonth() === period.month && rd.getFullYear() === period.year;
      }),
    [period],
  );
  const cancelledDeals = useMemo(
    () =>
      deals.filter((d) => {
        if (!d.cancelled) return false;
        const cd = new Date(d.cancelled.at);
        return cd.getMonth() === period.month && cd.getFullYear() === period.year;
      }),
    [period],
  );

  const status: RunStatus =
    statusByPeriod[key] ?? (registeredDeals.length > 0 ? "Draft" : "Not Started");

  const shiftPeriod = (delta: number) => {
    setPeriod((p) => {
      let m = p.month + delta;
      let y = p.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
      if (m > 11) {
        m = 0;
        y += 1;
      }
      return { month: m, year: y };
    });
  };

  const rules = ruleSets[0];

  const practitionerRows = useMemo(() => {
    const map = new Map<
      string,
      { gross: number; desk: number; advance: number; clawback: number; net: number }
    >();
    for (const dl of registeredDeals) {
      const gross = grossCommission(dl);
      const net = netPayable(dl);
      const desk = rules.deductions.find((x: any) => x.type === "Desk Fee")?.fixed ?? 0;
      for (const pr of dl.practitioners) {
        const share = Math.round((net * pr.splitPct) / 100);
        const deskShare = Math.round((desk * pr.splitPct) / 100);
        const advance = pr.userId === "u2" ? 150000 : 0;
        const entry = map.get(pr.userId) ?? { gross: 0, desk: 0, advance: 0, clawback: 0, net: 0 };
        entry.gross += Math.round((gross * pr.splitPct) / 100);
        entry.desk += deskShare;
        entry.advance += advance;
        entry.net += share - deskShare - advance;
        map.set(pr.userId, entry);
      }
    }
    for (const dl of cancelledDeals) {
      for (const pr of dl.practitioners) {
        const entry = map.get(pr.userId) ?? { gross: 0, desk: 0, advance: 0, clawback: 0, net: 0 };
        const clawback = Math.round(((grossCommission(dl) * pr.splitPct) / 100) * 0.5);
        entry.clawback += clawback;
        entry.net -= clawback;
        map.set(pr.userId, entry);
      }
    }
    return Array.from(map.entries()).map(([userId, v]) => ({ user: userById(userId), ...v }));
  }, [registeredDeals, cancelledDeals, rules]);

  const totals = useMemo(() => {
    const totalCommission = registeredDeals.reduce((s, dl) => s + grossCommission(dl), 0);
    const vat = Math.round(totalCommission - totalCommission / (1 + VAT_RATE));
    const franchise = registeredDeals.reduce((s, dl) => {
      const net =
        grossCommission(dl) -
        Math.round(grossCommission(dl) - grossCommission(dl) / (1 + VAT_RATE));
      return (
        s +
        Math.round(
          (net * (rules.deductions.find((x: any) => x.type === "Franchise Fee")?.bps ?? 0)) / 10000,
        )
      );
    }, 0);
    const officeShare = registeredDeals.reduce((s, dl) => {
      const net =
        grossCommission(dl) -
        Math.round(grossCommission(dl) - grossCommission(dl) / (1 + VAT_RATE));
      const franchiseAmt = Math.round(
        (net * (rules.deductions.find((x: any) => x.type === "Franchise Fee")?.bps ?? 0)) / 10000,
      );
      const pool = net - franchiseAmt;
      return s + Math.round((pool * rules.officeSharePct) / 100);
    }, 0);
    const agentPayouts = practitionerRows.reduce((s, r) => s + r.net, 0);
    return { totalCommission, vat, franchise, officeShare, agentPayouts };
  }, [registeredDeals, practitionerRows, rules]);

  const approveRun = () => {
    toast.error("Approval is unavailable on this legacy reconciliation view", {
      description: "Confirm each persisted deal calculation from the deal Commission tab.",
    });
  };

  const exportCsv = () => {
    const header = "Reference,Property,Sale Price,Gross Commission,Net Commission,Agents\n";
    const rows = registeredDeals.map((dl) => {
      const prop = propertyById(dl.propertyId);
      const agents = dl.practitioners.map((p: any) => userById(p.userId).name).join(" | ");
      return [
        dl.ref,
        `"${prop.address}, ${prop.suburb}"`,
        (dl.salePrice / 100).toFixed(2),
        (grossCommission(dl) / 100).toFixed(2),
        (netPayable(dl) / 100).toFixed(2),
        `"${agents}"`,
      ].join(",");
    });
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission-reconciliation-${period.year}-${String(period.month + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export downloaded");
  };

  const exportPdf = () => {
    toast.error("PDF generation requires the production report worker.");
  };

  const statusTone =
    status === "Approved"
      ? "border-success/30 bg-success/10 text-success"
      : status === "Draft"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-border bg-muted text-muted-foreground";

  return (
    <AppShell
      title="Monthly Commission Reconciliation"
      description="Review registered deals, practitioner payouts and clawbacks before approving a commission run."
      crumbs={[{ label: "Commission", to: "/commission" }, { label: "Reconciliation" }]}
    >
      <CommissionTabs />

      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="outline" size="icon" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-display min-w-[140px] text-center text-lg font-semibold">
            {MONTHS[period.month]} {period.year}
          </span>
          <Button variant="outline" size="icon" onClick={() => shiftPeriod(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Badge variant="outline" className={statusTone}>
          {status}
        </Badge>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {can && status !== "Approved" && registeredDeals.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2">
                <CheckCircle2 className="size-4" /> Approve Run
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve commission run?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will lock the {MONTHS[period.month]} {period.year} commission run for{" "}
                  {registeredDeals.length} registered deal(s) totalling {zar(totals.agentPayouts)}{" "}
                  in agent payouts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={approveRun}>Approve</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button variant="outline" className="gap-2" onClick={exportCsv}>
          <Download className="size-4" /> Export CSV
        </Button>
        <Button variant="outline" className="gap-2" onClick={exportPdf}>
          <FileText className="size-4" /> Export PDF
        </Button>
      </div>

      <GlassCard className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Registered Deals</h2>
        {loading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : registeredDeals.length === 0 ? (
          <EmptyState
            title="No deals registered"
            message="No deals were registered in this period."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Gross Commission</TableHead>
                  <TableHead className="text-right">Net Commission</TableHead>
                  <TableHead>Agents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registeredDeals.map((dl) => {
                  const prop = propertyById(dl.propertyId);
                  return (
                    <TableRow key={dl.id}>
                      <TableCell className="money whitespace-nowrap">{dl.ref}</TableCell>
                      <TableCell className="min-w-0 max-w-[220px] truncate">
                        {prop.address}, {prop.suburb}
                      </TableCell>
                      <TableCell className="money text-right whitespace-nowrap">
                        {zar(dl.salePrice)}
                      </TableCell>
                      <TableCell className="money text-right whitespace-nowrap">
                        {zar(grossCommission(dl))}
                      </TableCell>
                      <TableCell className="money text-right whitespace-nowrap">
                        {zar(netPayable(dl))}
                      </TableCell>
                      <TableCell>
                        <div className="flex -space-x-1.5">
                          {dl.practitioners.map((p: any) => (
                            <AgentAvatar key={p.userId} user={userById(p.userId)} />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>

      <GlassCard className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Per-Practitioner Summary</h2>
        {practitionerRows.length === 0 ? (
          <EmptyState
            title="No practitioner activity"
            message="No agent payouts to summarise for this period."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {practitionerRows.map((r) => (
              <div key={r.user.id} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AgentAvatar user={r.user} showName size={8} />
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Gross allocation</dt>
                    <dd className="money">{zar(r.gross)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Desk fees</dt>
                    <dd className="money text-destructive">− {zar(r.desk)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Advance recoveries</dt>
                    <dd className="money text-destructive">− {zar(r.advance)}</dd>
                  </div>
                  {r.clawback > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Clawbacks</dt>
                      <dd className="money text-destructive">− {zar(r.clawback)}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Net Payable
                  </span>
                  <span className="money text-xl font-bold">{zar(r.net)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {cancelledDeals.length > 0 && (
        <GlassCard className="mb-6 border-destructive/30">
          <h2 className="mb-4 font-display text-lg font-semibold text-destructive">
            Clawback Section — Cancelled Deals
          </h2>
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Cancelled</TableHead>
                  <TableHead className="text-right">Clawback Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancelledDeals.map((dl) => {
                  const prop = propertyById(dl.propertyId);
                  const amt = Math.round(grossCommission(dl) * 0.5);
                  return (
                    <TableRow key={dl.id}>
                      <TableCell className="money whitespace-nowrap">{dl.ref}</TableCell>
                      <TableCell className="min-w-0 max-w-[200px] truncate">
                        {prop.address}
                      </TableCell>
                      <TableCell>{dl.cancelled?.reason}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dl.cancelled ? dateFmt(dl.cancelled.at) : "—"}
                      </TableCell>
                      <TableCell className="money text-right whitespace-nowrap text-destructive">
                        − {zar(amt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <h2 className="mb-4 font-display text-lg font-semibold">Run Totals</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <TotalTile label="Total Commission" value={totals.totalCommission} />
          <TotalTile label="VAT" value={totals.vat} />
          <TotalTile label="Franchise Fees" value={totals.franchise} />
          <TotalTile label="Office Share" value={totals.officeShare} />
          <TotalTile label="Agent Payouts" value={totals.agentPayouts} highlight />
        </div>
      </GlassCard>
    </AppShell>
  );
}

function TotalTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-primary/5" : "border-border"}`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`money mt-1 text-lg font-bold ${highlight ? "text-primary" : ""}`}>
        {zar(value)}
      </p>
    </div>
  );
}
