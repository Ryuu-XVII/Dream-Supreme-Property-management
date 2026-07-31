import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Banknote, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, KpiCard, CardSkeleton, EmptyState } from "@/components/ui-kit";
import { UrgencyBadge, StatusDot } from "@/components/badges";
import { agency, STAGES } from "@/data/state";
import { useDashboardData } from "@/data/operations";
import {
  dateFmt,
  dateTimeFmt,
  daysUntil,
  relative,
  urgencyOf,
  zar,
  zarCompact,
} from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Agency-wide overview of pipeline, conditions, and commission for Dream Supreme Properties.",
      },
      { property: "og:title", content: "Dashboard | Dream Supreme Properties" },
      {
        property: "og:description",
        content:
          "Agency-wide overview of pipeline, conditions, and commission for Dream Supreme Properties.",
      },
    ],
  }),
  component: Index,
});

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

function Index() {
  const { data, isLoading: loading } = useDashboardData();
  const deals = useMemo(() => data?.deals ?? [], [data?.deals]);
  const openConditions = useMemo(() => data?.openConditions ?? [], [data?.openConditions]);
  const users = useMemo(() => data?.users ?? [], [data?.users]);
  const auditEvents = useMemo(() => data?.auditEvents ?? [], [data?.auditEvents]);
  const today = useMemo(() => new Date(), []);
  const forecast = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() + index, 1);
      return { month: date.toLocaleString("en-ZA", { month: "short" }), projected: 0 };
    });
    deals.forEach((deal) => {
      const target = deal.registeredAt ? new Date(deal.registeredAt) : new Date(deal.stageSince);
      const offset =
        (target.getFullYear() - today.getFullYear()) * 12 + target.getMonth() - today.getMonth();
      if (offset >= 0 && offset < months.length) {
        months[offset].projected += Math.round((deal.salePrice * deal.commissionBps) / 10000);
      }
    });
    return months;
  }, [deals, today]);

  const activeDeals = useMemo(
    () =>
      deals.filter(
        (d) => d.stage !== "Registered" && d.stage !== "Commission Released" && !d.cancelled,
      ),
    [deals],
  );
  const pipelineValue = useMemo(
    () =>
      deals
        .filter((d) => d.stage !== "Registered" && !d.cancelled)
        .reduce((s, d) => s + d.salePrice, 0),
    [deals],
  );
  const registeringThisMonth = useMemo(
    () =>
      deals.filter((d) => {
        if (!d.registeredAt) return d.stage === "Lodged" || d.stage === "Documents & Guarantees";
        const r = new Date(d.registeredAt);
        return r.getMonth() === today.getMonth() && r.getFullYear() === today.getFullYear();
      }).length,
    [deals, today],
  );
  const overdueConditions = useMemo(
    () => openConditions.filter((c) => daysUntil(c.dueDate) < 0).length,
    [openConditions],
  );
  const commissionMTD = useMemo(
    () =>
      deals
        .filter((d) => d.registeredAt && new Date(d.registeredAt).getMonth() === today.getMonth())
        .reduce((s, d) => s + Math.round((d.salePrice * d.commissionBps) / 10000), 0),
    [deals, today],
  );

  const stageCounts = useMemo(
    () =>
      STAGES.map((s) => ({
        stage: shortStage[s] ?? s,
        count: deals.filter((d) => d.stage === s && !d.cancelled).length,
      })),
    [deals],
  );

  const urgentConditions = useMemo(
    () =>
      [...openConditions].sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate)).slice(0, 5),
    [openConditions],
  );

  const recentEvents = useMemo(() => [...auditEvents].slice(0, 10), [auditEvents]);

  return (
    <AppShell title="Dashboard" description={`${agency.name} · ${dateFmt(today)}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                label="Active Deals"
                value={activeDeals.length}
                trend={8}
                sub="vs. last month"
                icon={Activity}
                delay={0}
              />
              <KpiCard
                label="Pipeline Value"
                value={zarCompact(pipelineValue)}
                sub="Non-registered deals"
                icon={Banknote}
                delay={0.05}
              />
              <KpiCard
                label="Registering This Month"
                value={registeringThisMonth}
                sub="Lodged & pending"
                icon={Calendar}
                delay={0.1}
              />
              <KpiCard
                label="Overdue Conditions"
                value={overdueConditions}
                tone={overdueConditions > 0 ? "danger" : "success"}
                sub={overdueConditions > 0 ? "Needs attention" : "All on track"}
                icon={AlertTriangle}
                delay={0.15}
              />
              <KpiCard
                label="Commission MTD"
                value={zarCompact(commissionMTD)}
                trend={12}
                sub="Gross, registered deals"
                icon={Banknote}
                delay={0.2}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <GlassCard className="xl:col-span-2">
            <h3 className="font-display text-base font-semibold">Pipeline Summary</h3>
            <p className="text-xs text-muted-foreground">Deal count per stage</p>
            {loading ? (
              <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageCounts} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="stage"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
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

          <GlassCard>
            <h3 className="font-display text-base font-semibold">Revenue Forecast</h3>
            <p className="text-xs text-muted-foreground">Projected gross commission</p>
            {loading ? (
              <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecast} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => zarCompact(v)}
                      tick={{ fontSize: 10 }}
                      width={56}
                    />
                    <Tooltip
                      formatter={(v: number) => zar(v)}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="projected" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <GlassCard>
            <h3 className="font-display text-base font-semibold">Urgent Conditions</h3>
            <p className="text-xs text-muted-foreground">Top 5 by days remaining</p>
            {loading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : urgentConditions.length === 0 ? (
              <EmptyState
                title="No open conditions"
                message="Every suspensive condition is resolved."
              />
            ) : (
              <div className="mt-4 space-y-1">
                {urgentConditions.map((c, i) => (
                  <Link
                    key={c.id}
                    to="/deals/$dealId"
                    params={{ dealId: c.deal.id }}
                    className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <StatusDot tone={urgencyOf(daysUntil(c.dueDate))} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-xs text-muted-foreground">{c.deal.ref}</span>{" "}
                      <span className="truncate">{c.type}</span>
                    </span>
                    <UrgencyBadge dueDate={c.dueDate} status={c.status} />
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <h3 className="font-display text-base font-semibold">Recent Activity</h3>
            <p className="text-xs text-muted-foreground">Last 10 audit events</p>
            {loading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : (
              <ol className="mt-4 space-y-0 border-l border-border pl-4">
                {recentEvents.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="relative pb-4 last:pb-0"
                  >
                    <span className="absolute -left-5.25 top-1 size-2.5 rounded-full bg-primary" />
                    <p className="min-w-0 truncate text-sm">{e.summary}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {e.user} · {e.entityRef} · {relative(e.at)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">{dateTimeFmt(e.at)}</p>
                  </motion.li>
                ))}
              </ol>
            )}
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
