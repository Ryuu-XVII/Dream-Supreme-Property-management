import { useMemo, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import {
  deals, STAGES, branches, users, fallThroughReasons, monthlyCommission, forecast,
  type Stage,
} from "@/data/state";
import { zar, zarCompact, dateFmt, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, FileText } from "lucide-react";

const REPORTS = ["pipeline", "fall-through", "commission", "compliance"] as const;
type ReportKey = (typeof REPORTS)[number];

const REPORT_META: Record<ReportKey, { title: string; description: string }> = {
  pipeline: { title: "Pipeline Report", description: "Deals by stage, average time-in-stage, and stage conversion." },
  "fall-through": { title: "Fall-Through Report", description: "Why deals cancel, and how the trend is moving." },
  commission: { title: "Commission Report", description: "Agent earnings, cumulative payouts and agency totals." },
  compliance: { title: "Compliance Report", description: "FFC currency and FICA completion across the agency." },
};

export const Route = createFileRoute("/reports/$report")({
  loader: ({ params }) => {
    if (!REPORTS.includes(params.report as ReportKey)) throw notFound();
    return { report: params.report as ReportKey };
  },
  head: ({ loaderData }) => {
    const meta = loaderData ? REPORT_META[loaderData.report] : { title: "Report", description: "Agency report." };
    return {
      meta: [
        { title: `${meta.title} | Dream Supreme Properties` },
        { name: "description", content: meta.description },
        { property: "og:title", content: `${meta.title} | Dream Supreme Properties` },
        { property: "og:description", content: meta.description },
      ],
    };
  },
  component: ReportPage,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportChrome({
  reportKey,
  children,
  csvRows,
  csvFilename,
}: {
  reportKey: ReportKey;
  children: React.ReactNode;
  csvRows: (string | number)[][];
  csvFilename: string;
}) {
  const [branch, setBranch] = useState("all");
  const [agent, setAgent] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const meta = REPORT_META[reportKey];

  return (
    <AppShell
      title={meta.title}
      description={meta.description}
      crumbs={[{ label: "Reports", to: "/reports" }, { label: meta.title }]}
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(csvFilename, csvRows)}>
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.success("PDF export queued", { description: "Your report will be emailed shortly." })}
          >
            <FileText className="size-3.5" /> Export PDF
          </Button>
        </>
      }
    >
      <GlassCard className="mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <label className="mb-1 block text-xs text-muted-foreground">Branch</label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs text-muted-foreground">Agent</label>
            <Select value={agent} onValueChange={setAgent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {users.filter((u) => u.role === "Agent").map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Date range</label>
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
      </GlassCard>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
        {children}
      </motion.div>
    </AppShell>
  );
}

/* ---------------- Pipeline ---------------- */

function PipelineReport() {
  const activeDeals = deals.filter((d) => !d.cancelled);

  const byStageBranch = useMemo(() => {
    return STAGES.map((stage) => {
      const row: Record<string, string | number> = { stage };
      branches.forEach((b) => {
        row[b.name] = activeDeals.filter((d) => d.stage === stage && d.branch === b.name).length;
      });
      return row;
    });
  }, [activeDeals]);

  const avgDaysInStage = useMemo(() => {
    return STAGES.map((stage) => {
      const inStage = activeDeals.filter((d) => d.stage === stage);
      const avg = inStage.length
        ? Math.round(inStage.reduce((a, d) => a + (Date.now() - new Date(d.stageSince).getTime()) / 86400000, 0) / inStage.length)
        : 0;
      return { stage, days: avg };
    }).filter((r) => r.days > 0);
  }, [activeDeals]);

  const funnel = useMemo(() => {
    const total = deals.length;
    return STAGES.map((stage, i) => {
      const reached = deals.filter((d) => STAGES.indexOf(d.stage) >= i || (d.cancelled && STAGES.indexOf(d.stage) >= i)).length;
      return { stage, reached, pctOfTotal: total ? Math.round((reached / total) * 100) : 0 };
    });
  }, []);

  const maxFunnel = funnel[0]?.reached || 1;

  const csvRows: (string | number)[][] = [
    ["Stage", ...branches.map((b) => b.name), "Avg days in stage", "Reached (%)"],
    ...STAGES.map((stage, i) => [
      stage,
      ...branches.map((b) => activeDeals.filter((d) => d.stage === stage && d.branch === b.name).length),
      avgDaysInStage.find((a) => a.stage === stage)?.days ?? 0,
      funnel[i].pctOfTotal,
    ]),
  ];

  return (
    <ReportChrome reportKey="pipeline" csvRows={csvRows} csvFilename="pipeline-report.csv">
      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Deals by stage &amp; branch</h3>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStageBranch} margin={{ left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={90} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {branches.map((b, i) => (
                <Bar key={b.id} dataKey={b.name} stackId="branch" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === branches.length - 1 ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">Average days in stage</h3>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avgDaysInStage} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 10 }} width={140} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="days" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} name="Avg days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">Stage-to-stage conversion funnel</h3>
          <div className="space-y-2">
            {funnel.map((f, i) => (
              <div key={f.stage} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{i + 1}. {f.stage}</span>
                  <span className="money shrink-0 font-medium">{f.reached} deals · {f.pctOfTotal}%</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (f.reached / maxFunnel) * 100)}%`,
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Stage detail</h3>
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                {branches.map((b) => <TableHead key={b.id} className="text-right">{b.name}</TableHead>)}
                <TableHead className="text-right">Avg days</TableHead>
                <TableHead className="text-right">Reached %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STAGES.map((stage, i) => (
                <TableRow key={stage}>
                  <TableCell className="max-w-[200px] truncate">{stage}</TableCell>
                  {branches.map((b) => (
                    <TableCell key={b.id} className="text-right">{activeDeals.filter((d) => d.stage === stage && d.branch === b.name).length}</TableCell>
                  ))}
                  <TableCell className="text-right">{avgDaysInStage.find((a) => a.stage === stage)?.days ?? 0}</TableCell>
                  <TableCell className="text-right">{funnel[i].pctOfTotal}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </ReportChrome>
  );
}

/* ---------------- Fall-through ---------------- */

function FallThroughReport() {
  const total = fallThroughReasons.reduce((a, r) => a + r.count, 0);
  const trend = monthlyCommission.map((m, i) => ({
    month: m.month,
    cancellations: Math.max(1, Math.round((fallThroughReasons[i % fallThroughReasons.length].count + i) / 1.6)),
  }));

  const csvRows: (string | number)[][] = [
    ["Reason", "Count", "Share (%)"],
    ...fallThroughReasons.map((r) => [r.reason, r.count, Math.round((r.count / total) * 100)]),
  ];

  return (
    <ReportChrome reportKey="fall-through" csvRows={csvRows} csvFilename="fall-through-report.csv">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">Cancellations by reason</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fallThroughReasons} dataKey="count" nameKey="reason" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {fallThroughReasons.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">Monthly fall-through trend</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="cancellations" stroke="var(--color-chart-3)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Reason breakdown</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fallThroughReasons.map((r) => (
              <TableRow key={r.reason}>
                <TableCell>{r.reason}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell className="text-right">{Math.round((r.count / total) * 100)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </ReportChrome>
  );
}

/* ---------------- Commission ---------------- */

function CommissionReport() {
  const agentNames = users.filter((u) => u.role === "Agent").slice(0, 4);

  const byAgent = useMemo(() => {
    return monthlyCommission.map((m, i) => {
      const row: Record<string, string | number> = { month: m.month };
      agentNames.forEach((a, ai) => {
        row[a.name] = Math.round((m.agent / agentNames.length) * (0.7 + ((i + ai) % 4) * 0.18));
      });
      return row;
    });
  }, [agentNames]);

  const cumulative = useMemo(() => {
    let running = 0;
    return monthlyCommission.map((m) => {
      running += m.gross;
      return { month: m.month, cumulative: running };
    });
  }, []);

  const totalGross = monthlyCommission.reduce((a, m) => a + m.gross, 0);
  const nextForecast = forecast[0] ?? { projected: 0 };

  const csvRows: (string | number)[][] = [
    ["Month", "Agency gross (ZAR)", "Cumulative YTD (ZAR)"],
    ...monthlyCommission.map((m, i) => [m.month, m.gross / 100, cumulative[i]?.cumulative ? cumulative[i].cumulative / 100 : 0]),
  ];

  return (
    <ReportChrome reportKey="commission" csvRows={csvRows} csvFilename="commission-report.csv">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GlassCard>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total agency commission</p>
          <p className="money mt-2 text-2xl font-semibold">{zar(totalGross, { decimals: false })}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last month gross</p>
          <p className="money mt-2 text-2xl font-semibold">{zar(monthlyCommission[monthlyCommission.length - 1]?.gross ?? 0, { decimals: false })}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next month forecast</p>
          <p className="money mt-2 text-2xl font-semibold text-info">{zar(nextForecast?.projected ?? 0, { decimals: false })}</p>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Monthly earnings by agent</h3>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byAgent}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => zarCompact(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: number) => zar(v, { decimals: false })} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {agentNames.map((a, i) => (
                <Bar key={a.id} dataKey={a.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Cumulative YTD agency commission</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => zarCompact(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: number) => zar(v, { decimals: false })} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="cumulative" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Monthly totals</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Agency gross</TableHead>
              <TableHead className="text-right">Agent share</TableHead>
              <TableHead className="text-right">Cumulative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyCommission.map((m, i) => (
              <TableRow key={m.month}>
                <TableCell>{m.month}</TableCell>
                <TableCell className="money text-right">{zar(m.gross, { decimals: false })}</TableCell>
                <TableCell className="money text-right">{zar(m.agent, { decimals: false })}</TableCell>
                <TableCell className="money text-right">{zar(cumulative[i].cumulative, { decimals: false })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </ReportChrome>
  );
}

/* ---------------- Compliance ---------------- */

function ComplianceReport() {
  const ffcSummary = useMemo(() => {
    const now = Date.now();
    let current = 0, expiringSoon = 0, expired = 0, none = 0;
    users.forEach((u) => {
      if (!u.ffc) { none++; return; }
      if (!u.ffc.expiry) { current++; return; }
      const days = Math.round((new Date(u.ffc.expiry).getTime() - now) / 86400000);
      if (days < 0) expired++;
      else if (days <= 30) expiringSoon++;
      else current++;
    });
    return [
      { name: "Current", value: current, tone: "var(--color-chart-1)" },
      { name: "Expiring ≤30d", value: expiringSoon, tone: "var(--color-chart-4)" },
      { name: "Expired", value: expired, tone: "var(--color-chart-5)" },
      { name: "No FFC", value: none, tone: "var(--color-chart-3)" },
    ].filter((s) => s.value > 0);
  }, []);

  const ficaByPartyType = useMemo(() => {
    const map = new Map<string, { total: number; complete: number }>();
    deals.forEach((d) => {
      d.parties.forEach((p) => {
        const entry = map.get(p.entityType) ?? { total: 0, complete: 0 };
        entry.total++;
        if (p.fica === "Complete") entry.complete++;
        map.set(p.entityType, entry);
      });
    });
    return Array.from(map.entries()).map(([type, v]) => ({
      type,
      total: v.total,
      complete: v.complete,
      pctComplete: v.total ? Math.round((v.complete / v.total) * 100) : 0,
    }));
  }, []);

  const csvRows: (string | number)[][] = [
    ["Metric", "Value"],
    ...ffcSummary.map((s) => [`FFC — ${s.name}`, s.value]),
    ...ficaByPartyType.map((f) => [`FICA complete — ${f.type}`, `${f.complete}/${f.total} (${f.pctComplete}%)`]),
  ];

  return (
    <ReportChrome reportKey="compliance" csvRows={csvRows} csvFilename="compliance-report.csv">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">FFC status summary</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ffcSummary} dataKey="value" nameKey="name" innerRadius={65} outerRadius={110} paddingAngle={2}>
                  {ffcSummary.map((s, i) => <Cell key={i} fill={s.tone} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4 text-sm font-semibold">FICA completion rate by party type</h3>
          <div className="space-y-4">
            {ficaByPartyType.map((f) => (
              <div key={f.type} className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{f.type}</span>
                  <span className="money shrink-0 text-xs text-muted-foreground">{f.complete}/{f.total} · {f.pctComplete}%</span>
                </div>
                <Progress value={f.pctComplete} className="h-2.5" />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold">Agent FFC detail</h3>
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>FFC number</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const days = u.ffc?.expiry ? Math.round((new Date(u.ffc.expiry).getTime() - Date.now()) / 86400000) : null;
                const status = !u.ffc ? "No FFC" : days === null ? "Current" : days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Current";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="max-w-[160px] truncate">{u.name}</TableCell>
                    <TableCell>{u.branch}</TableCell>
                    <TableCell className="font-mono text-xs">{u.ffc?.number ?? "—"}</TableCell>
                    <TableCell>{u.ffc?.expiry ? dateFmt(u.ffc.expiry) : "—"}</TableCell>
                    <TableCell className="text-right">{status}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </ReportChrome>
  );
}

function ReportPage() {
  const { report } = Route.useLoaderData();
  switch (report) {
    case "pipeline": return <PipelineReport />;
    case "fall-through": return <FallThroughReport />;
    case "commission": return <CommissionReport />;
    case "compliance": return <ComplianceReport />;
  }
}
