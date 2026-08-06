import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";
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
import { useDashboardData } from "@/data/operations";
import { dateFmt, daysUntil } from "@/lib/format";

export const Route = createFileRoute("/compliance/ffc")({ component: FfcPage });

function FfcPage() {
  const dashboard = useDashboardData();
  const users = dashboard.data?.users ?? [];
  return (
    <AppShell title="Compliance" description="Live Fidelity Fund Certificate records.">
      <ComplianceTabs />
      {dashboard.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : users.length === 0 ? (
        <GlassCard>
          <EmptyState title="No users found" message="No visible team members have been loaded." />
        </GlassCard>
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Practitioner</TableHead>
                <TableHead>PPRA reference</TableHead>
                <TableHead>FFC number</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const remaining = user.ffc?.expiry ? daysUntil(user.ffc.expiry) : null;
                const label = !user.ffc
                  ? "Missing"
                  : remaining !== null && remaining < 0
                    ? "Expired"
                    : remaining !== null && remaining <= 30
                      ? "Expiring"
                      : "Valid";
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.ppra}</TableCell>
                    <TableCell>{user.ffc?.number ?? "—"}</TableCell>
                    <TableCell>{user.ffc?.expiry ? dateFmt(user.ffc.expiry) : "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={label === "Valid" ? "text-success" : "text-destructive"}
                      >
                        {label}
                      </Badge>
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
