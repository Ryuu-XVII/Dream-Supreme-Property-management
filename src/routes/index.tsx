import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { m as motion } from "framer-motion";
import { Activity, AlertTriangle, Banknote, Calendar, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, KpiCard, CardSkeleton, EmptyState } from "@/components/ui-kit";
import { UrgencyBadge, StatusDot } from "@/components/badges";
import { STAGES } from "@/types";
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
          "Agency-wide overview of pipeline, conditions, FFC compliance and commission for Dream Supreme Properties.",
      },
      { property: "og:title", content: "Dashboard | Dream Supreme Properties" },
      {
        property: "og:description",
        content:
          "Agency-wide overview of pipeline, conditions, FFC compliance and commission for Dream Supreme Properties.",
      },
    ],
  }),
  component: Index,
});

// TODO: always empty — no code path populates a registration forecast yet, so
// the "Registration Forecast" chart permanently shows its empty state.
const forecast: Array<{ month: string; projected: number }> = [];

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
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const isAdminDomain =
        hostname.startsWith("admin.") ||
        hostname.startsWith("admin-") ||
        hostname === "admin.localhost" ||
        (import.meta.env.VITE_ADMIN_DOMAIN &&
          (window.location.origin === import.meta.env.VITE_ADMIN_DOMAIN ||
            window.location.hostname === import.meta.env.VITE_ADMIN_DOMAIN));
      const isImpersonating = !!sessionStorage.getItem("ds_impersonated_session_account");
      if (isAdminDomain && !isImpersonating) {
        window.location.replace("/admin");
      }
    }
  }, []);

  const dashboard = useDashboardData();
  const loading = dashboard.isLoading;
  const deals = useMemo(() => dashboard.data?.deals ?? [], [dashboard.data?.deals]);
  const openConditions = useMemo(
    () => dashboard.data?.openConditions ?? [],
    [dashboard.data?.openConditions],
  );
  const users = useMemo(() => dashboard.data?.users ?? [], [dashboard.data?.users]);
  const auditEvents = useMemo(
    () => dashboard.data?.auditEvents ?? [],
    [dashboard.data?.auditEvents],
  );
  const today = useMemo(() => new Date(), []);

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

  const ffcAlerts = useMemo(
    () =>
      users.filter((u) => {
        if (!u.ffc) return true;
        if (!u.ffc.expiry) return false;
        return daysUntil(u.ffc.expiry) <= 30;
      }),
    [users],
  );

  const recentEvents = useMemo(() => [...auditEvents].slice(0, 10), [auditEvents]);

  return (
    <AppShell title="Dashboard" description={`Dream Supreme Properties · ${dateFmt(today)}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                label="Active Deals"
                value={activeDeals.length}
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
            ) : forecast.length === 0 ? (
              <EmptyState
                title="No forecast data"
                message="No projected deals in the current forecast timeline."
              />
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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
                    to={"/pipeline" as any}
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
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-warning" />
              <h3 className="font-display text-base font-semibold">FFC Alerts</h3>
            </div>
            <p className="text-xs text-muted-foreground">Missing or expiring within 30 days</p>
            {loading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : ffcAlerts.length === 0 ? (
              <EmptyState
                title="All FFCs valid"
                message="No agents have expiring or missing certificates."
              />
            ) : (
              <div className="mt-4 space-y-2">
                {ffcAlerts.map((u) => {
                  const status = !u.ffc
                    ? "Missing"
                    : !u.ffc.expiry
                      ? "Unknown"
                      : daysUntil(u.ffc.expiry) < 0
                        ? "Expired"
                        : `Expires in ${daysUntil(u.ffc.expiry)}d`;
                  return (
                    <div
                      key={u.id}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm">{u.name}</span>
                      <span
                        className={
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                          (status === "Missing" || status === "Expired"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-warning/40 bg-warning/15 text-warning")
                        }
                      >
                        {status}
                      </span>
                    </div>
                  );
                })}
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
            ) : recentEvents.length === 0 ? (
              <EmptyState
                title="No recent activity"
                message="No recent system actions or audit logs recorded."
              />
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
