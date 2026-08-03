import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard, KpiCard } from "@/components/ui-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar } from "@/lib/format";
import { Store, TrendingUp, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/franchise")({
  component: FranchiseDashboard,
});

interface BranchPerformance {
  branchId: string;
  branchName: string;
  franchiseFeePct: number;
  totalDeals: number;
  totalGrossSales: number;
  totalNetComm: number;
  totalFranchiseFees: number;
}

function FranchiseDashboard() {
  const { account } = useAuth();

  const { data: branches, isLoading } = useQuery({
    queryKey: ["franchise-performance", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      // Fetch all branches for the agency
      const { data: branchData, error: branchError } = await supabase
        .from("branch")
        .select("id, name, franchise_fee_pct")
        .eq("agency_id", account!.agencyId)
        .is("archived_at", null);

      if (branchError) throw branchError;

      // Fetch all confirmed calculations to aggregate
      const { data: calcs, error: calcError } = await supabase
        .from("commission_calculation")
        .select(
          `
          deal_id,
          gross_cents,
          net_cents,
          franchise_fee_cents,
          deal (
            branch_id
          )
        `,
        )
        .eq("status", "confirmed");

      if (calcError) throw calcError;

      const performanceMap = new Map<string, BranchPerformance>();

      branchData?.forEach((b) => {
        performanceMap.set(b.id, {
          branchId: b.id,
          branchName: b.name,
          franchiseFeePct: Number(b.franchise_fee_pct),
          totalDeals: 0,
          totalGrossSales: 0,
          totalNetComm: 0,
          totalFranchiseFees: 0,
        });
      });

      // Aggregate data
      calcs?.forEach((calc) => {
        const branchId = (calc.deal as any)?.branch_id;
        if (branchId && performanceMap.has(branchId)) {
          const stats = performanceMap.get(branchId)!;
          stats.totalDeals++;
          stats.totalGrossSales += calc.gross_cents;
          stats.totalNetComm += calc.net_cents;
          stats.totalFranchiseFees += calc.franchise_fee_cents;
        }
      });

      return Array.from(performanceMap.values()).sort(
        (a, b) => b.totalFranchiseFees - a.totalFranchiseFees,
      );
    },
  });

  const totalNetworkSales = branches?.reduce((acc, b) => acc + b.totalGrossSales, 0) || 0;
  const totalNetworkFees = branches?.reduce((acc, b) => acc + b.totalFranchiseFees, 0) || 0;
  const totalNetworkBranches = branches?.length || 0;

  return (
    <>
      <AdminPageHeader
        title="Franchise Performance Portal"
        description="Monitor sub-branch performance, network sales volume, and collect master franchise fees."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <KpiCard
          label="Total Network Branches"
          value={totalNetworkBranches}
          trend={0}
          icon={Store}
          delay={0}
        />
        <KpiCard
          label="Total Network Sales (Gross Comm)"
          value={zar(totalNetworkSales / 100)}
          trend={0}
          icon={TrendingUp}
          delay={0.1}
        />
        <KpiCard
          label="Total Franchise Fees Collected"
          value={zar(totalNetworkFees / 100)}
          trend={0}
          icon={DollarSign}
          delay={0.2}
        />
      </div>

      <GlassCard className="p-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">Network Leaderboard</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch Name</TableHead>
              <TableHead>Fee Tier</TableHead>
              <TableHead>Closed Deals</TableHead>
              <TableHead>Gross Commission</TableHead>
              <TableHead>Franchise Fees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Loading branch performance...
                </TableCell>
              </TableRow>
            ) : !branches || branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No active branches found in your network.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((b) => (
                <TableRow key={b.branchId}>
                  <TableCell className="font-medium">{b.branchName}</TableCell>
                  <TableCell>{b.franchiseFeePct}%</TableCell>
                  <TableCell>{b.totalDeals}</TableCell>
                  <TableCell>{zar(b.totalGrossSales / 100)}</TableCell>
                  <TableCell className="text-emerald-500 font-medium">
                    {zar(b.totalFranchiseFees / 100)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </>
  );
}
