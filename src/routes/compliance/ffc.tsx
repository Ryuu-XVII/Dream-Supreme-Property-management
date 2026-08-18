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
import { useAuth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-routing";
import { dateFmt, daysUntil } from "@/lib/format";

export const Route = createFileRoute("/compliance/ffc")({ component: FfcPage });

function FfcPage() {
  const dashboard = useDashboardData();
  const { activeAccount } = useAuth();
  const isAdmin = canAccessAdmin(activeAccount);

  // An agent has no business seeing a colleague's PPRA reference or FFC
  // number. Administrators keep the agency-wide register, which is also what
  // Admin > Compliance shows. The database enforces the same split for the
  // certificate itself (see 20260818000009); the practitioner name and PPRA
  // reference come from the agency directory, which stays readable for agent
  // pickers, so this scoping is done here.
  const allUsers = dashboard.data?.users ?? [];
  const users = isAdmin ? allUsers : allUsers.filter((u) => u.id === activeAccount?.id);

  return (
    <AppShell
      title="Compliance"
      description={
        isAdmin
          ? "Live Fidelity Fund Certificate records."
          : "Your Fidelity Fund Certificate record."
      }
    >
      <ComplianceTabs />
      {dashboard.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : users.length === 0 ? (
        <GlassCard>
          <EmptyState
            title={isAdmin ? "No users found" : "No FFC record"}
            message={
              isAdmin
                ? "No visible team members have been loaded."
                : "Your Fidelity Fund Certificate has not been captured yet."
            }
          />
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
