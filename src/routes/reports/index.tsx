import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { zarCompact, pct } from "@/lib/format";
import { ArrowRight, GitBranch, AlertTriangle, Wallet, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title: "Reports | Dream Supreme Properties" },
      {
        name: "description",
        content: "Pipeline, fall-through, commission and compliance reporting for the agency.",
      },
      { property: "og:title", content: "Reports | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Pipeline, fall-through, commission and compliance reporting for the agency.",
      },
    ],
  }),
  component: ReportsHub,
});

function ReportsHub() {
  const { account } = useAuth();
  const reportsQuery = useQuery({
    queryKey: ["reports-summary", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const [dealsRes, usersRes, commissionRes] = await Promise.all([
        supabase
          .from("deal")
          .select("stage, cancellation_reason")
          .eq("agency_id", account!.agencyId),
        supabase
          .from("user_account")
          .select("id, ffc:ffc_certificate(expires_on)")
          .eq("agency_id", account!.agencyId),
        supabase
          .from("commission_calculation")
          .select("gross_commission_cents")
          .eq("agency_id", account!.agencyId)
          .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString())
      ]);

      if (dealsRes.error) throw dealsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (commissionRes.error) throw commissionRes.error;

      const activeDeals = dealsRes.data.filter(d => d.stage !== "CANCELLED" && d.stage !== "REGISTERED").length;
      const totalCancellations = dealsRes.data.filter(d => d.stage === "CANCELLED").length;
      const compliantUsers = usersRes.data.filter(u => 
        u.ffc?.[0]?.expires_on && new Date(u.ffc[0].expires_on) > new Date()
      ).length;
      const totalUsers = usersRes.data.length || 1;
      
      const lastMonthGross = commissionRes.data.reduce((acc, curr) => acc + (curr.gross_commission_cents || 0), 0);

      return {
        activeDeals,
        totalCancellations,
        compliantUsers,
        totalUsers,
        lastMonthGross
      };
    }
  });

  const { activeDeals = 0, totalCancellations = 0, compliantUsers = 0, totalUsers = 1, lastMonthGross = 0 } = reportsQuery.data || {};

  const reportCards = [
    {
      key: "pipeline",
      title: "Pipeline Report",
      description:
        "Deals by stage across branches, average days-in-stage, and stage-to-stage conversion funnel.",
      icon: GitBranch,
      stat: `${activeDeals} active deals`,
      tone: "bg-info/10 text-info",
    },
    {
      key: "fall-through",
      title: "Fall-Through Report",
      description:
        "Cancellation reasons breakdown and the monthly fall-through trend across the agency.",
      icon: AlertTriangle,
      stat: `${totalCancellations} cancellations YTD`,
      tone: "bg-destructive/10 text-destructive",
    },
    {
      key: "commission",
      title: "Commission Report",
      description:
        "Monthly earnings by agent, cumulative year-to-date commission, and total agency payouts.",
      icon: Wallet,
      stat: `${zarCompact(lastMonthGross)} gross last month`,
      tone: "bg-success/10 text-success",
    },
    {
      key: "compliance",
      title: "Compliance Report",
      description: "FFC status across agents and FICA completion rates by party type.",
      icon: ShieldCheck,
      stat: `${pct(Math.round((compliantUsers / totalUsers) * 10000))} agents FFC current`,
      tone: "bg-warning/15 text-warning",
    },
  ] as const;

  return (
    <AppShell
      title="Reports"
      description="Agency-wide performance and compliance reporting."
      crumbs={[{ label: "Reports" }]}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((r, i) => (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <Link to="/reports/$report" params={{ report: r.key }} className="block h-full">
              <GlassCard className="flex h-full flex-col justify-between">
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-xl ${r.tone}`}
                    >
                      <r.icon className="size-5" />
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                  <h3 className="mb-1.5 truncate text-base font-semibold">{r.title}</h3>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                </div>
                <p className="money mt-5 text-sm font-semibold text-foreground">{r.stat}</p>
              </GlassCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}
