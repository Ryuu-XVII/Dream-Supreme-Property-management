import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, TrendingUp, Home, Calculator } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CommissionTabs } from "@/components/commission/commission-tabs";
import { GlassCard, KpiCard, EmptyState, useFakeLoad, TableSkeleton } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  monthlyCommission,
  advances,
  userById,
  netPayable,
} from "@/data/mock";
import { dateFmt, zar } from "@/lib/format";

export const Route = createFileRoute("/commission/earnings")({
  head: () => ({
    meta: [
      { title: "Agent Earnings | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Riaan van Niekerk's year-to-date commission earnings, deal breakdown, advances and tier progress.",
      },
      { property: "og:title", content: "Agent Earnings | Dream Supreme Properties" },
      {
        property: "og:description",
        content:
          "Riaan van Niekerk's year-to-date commission earnings, deal breakdown, advances and tier progress.",
      },
    ],
  }),
  component: EarningsPage,
});

const AGENT_ID = "u2"; // Riaan van Niekerk

const TIERS = [
  { threshold: 0, split: 45 },
  { threshold: 1000000000, split: 50 },
  { threshold: 1500000000, split: 55 },
  { threshold: 2500000000, split: 60 },
];

function EarningsPage() {
  const loading = useFakeLoad(500);
  const agent = userById(AGENT_ID);

  const myRegisteredDeals = useMemo(
    () => deals.filter((d) => d.registeredAt && d.practitioners.some((p) => p.userId === AGENT_ID)),
    [],
  );

  const myAdvances = useMemo(() => advances.filter((a) => a.userId === AGENT_ID), []);

  const dealRows = useMemo(
    () =>
      myRegisteredDeals.map((dl) => {
        const pr = dl.practitioners.find((p) => p.userId === AGENT_ID)!;
        const commission = Math.round((netPayable(dl) * pr.splitPct) / 100);
        return { deal: dl, property: propertyById(dl.propertyId), commission };
      }),
    [myRegisteredDeals],
  );

  const ytdEarnings = dealRows.reduce((s, r) => s + r.commission, 0);
  const dealsYtd = dealRows.length;
  const avgPerDeal = dealsYtd > 0 ? Math.round(ytdEarnings / dealsYtd) : 0;

  const pendingPipeline = useMemo(
    () =>
      deals
        .filter(
          (d) =>
            !d.registeredAt && !d.cancelled && d.practitioners.some((p) => p.userId === AGENT_ID),
        )
        .reduce((s, d) => {
          const pr = d.practitioners.find((p) => p.userId === AGENT_ID)!;
          const gross = Math.round((d.salePrice * d.commissionBps) / 10000);
          return s + Math.round(((gross * pr.splitPct) / 100) * 0.5);
        }, 0),
    [],
  );

  const currentTierIndex = TIERS.reduce((acc, t, i) => (ytdEarnings >= t.threshold ? i : acc), 0);
  const currentTier = TIERS[currentTierIndex];
  const nextTier = TIERS[currentTierIndex + 1];
  const tierProgressPct = nextTier
    ? Math.min(
        100,
        Math.round(
          ((ytdEarnings - currentTier.threshold) / (nextTier.threshold - currentTier.threshold)) *
            100,
        ),
      )
    : 100;

  return (
    <AppShell
      title="Agent Earnings"
      description={`Year-to-date commission earnings for ${agent.name}.`}
      crumbs={[{ label: "Commission", to: "/commission" }, { label: "Earnings" }]}
    >
      <CommissionTabs />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass lift relative overflow-hidden rounded-xl p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-success/10" />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              YTD Total Earnings
            </p>
            <p className="money mt-2 text-4xl font-bold sm:text-5xl">
              {loading ? "—" : zar(ytdEarnings)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Across {dealsYtd} registered deal(s) this year
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <KpiCard
            label="Pending in Pipeline"
            value={zar(pendingPipeline)}
            icon={Wallet}
            tone="warning"
            sub="Estimated, unregistered"
          />
          <KpiCard
            label="Deals Registered YTD"
            value={String(dealsYtd)}
            icon={Home}
            tone="default"
          />
          <KpiCard
            label="Avg. Commission / Deal"
            value={zar(avgPerDeal)}
            icon={Calculator}
            tone="success"
          />
        </div>
      </div>

      <GlassCard className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Monthly Commission Trend</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyCommission}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickFormatter={(v) => `R${(v / 100000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => zar(value)}
              />
              <Bar
                dataKey="agent"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
                name="Agent Commission"
              />
              <Bar
                dataKey="gross"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
                name="Gross Commission"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Deal Breakdown</h2>
        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : dealRows.length === 0 ? (
          <EmptyState
            title="No registered deals"
            message="No registered deals yet for this agent."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Commission Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealRows.map(({ deal, property, commission }) => (
                  <TableRow key={deal.id}>
                    <TableCell className="whitespace-nowrap">
                      {deal.registeredAt ? dateFmt(deal.registeredAt) : "—"}
                    </TableCell>
                    <TableCell className="min-w-0 max-w-[240px] truncate">
                      {property.address}, {property.suburb}
                    </TableCell>
                    <TableCell className="money text-right whitespace-nowrap">
                      {zar(deal.salePrice)}
                    </TableCell>
                    <TableCell className="money text-right whitespace-nowrap font-semibold">
                      {zar(commission)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>

      <GlassCard className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Advances</h2>
        {myAdvances.length === 0 ? (
          <EmptyState
            title="No advances"
            message="No commission advances have been issued to this agent."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Deal Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Recovered</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myAdvances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{dateFmt(a.date)}</TableCell>
                    <TableCell className="money whitespace-nowrap">{a.dealRef}</TableCell>
                    <TableCell className="money text-right whitespace-nowrap">
                      {zar(a.amount)}
                    </TableCell>
                    <TableCell className="money text-right whitespace-nowrap">
                      {zar(a.recovered)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          a.status === "Recovered"
                            ? "border-success/30 bg-success/10 text-success"
                            : a.status === "Partial"
                              ? "border-warning/40 bg-warning/15 text-warning"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                        }
                      >
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Tier Progress</h2>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Current tier split:{" "}
            <span className="money font-semibold text-foreground">{currentTier.split}%</span>
          </span>
          {nextTier && (
            <span className="text-muted-foreground">
              Next tier at{" "}
              <span className="money font-semibold text-foreground">{zar(nextTier.threshold)}</span>
              : <span className="money font-semibold text-foreground">{nextTier.split}%</span>
            </span>
          )}
        </div>
        <Progress value={tierProgressPct} className="mt-3 h-3" />
        <p className="mt-2 text-xs text-muted-foreground">
          {nextTier
            ? `${zar(ytdEarnings)} of ${zar(nextTier.threshold)} toward the ${nextTier.split}% split tier (${tierProgressPct}%)`
            : "Highest tier reached for this year."}
        </p>
      </GlassCard>
    </AppShell>
  );
}
