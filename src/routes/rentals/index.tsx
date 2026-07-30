import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, ArrowRight, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar, dateFmt } from "@/lib/format";

export const Route = createFileRoute("/rentals/")({
  component: RentalsDashboard,
});

function RentalsDashboard() {
  const { account } = useAuth();
  const navigate = useNavigate();

  const leasesQuery = useQuery({
    queryKey: ["leases", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease")
        .select(
          `
          id,
          tenant_name,
          rent_amount_cents,
          start_date,
          end_date,
          status,
          managed_by,
          property:property_id(id, address, suburb)
        `,
        )
        .eq("agency_id", account!.agencyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      title="Rentals Management"
      description="Manage active leases, track tenant invoices, and log maintenance tickets."
      actions={
        <Button onClick={() => navigate({ to: "/" })} disabled>
          <PlusCircle className="mr-2 size-4" /> New Lease
        </Button>
      }
    >
      <GlassCard className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="text-right">Monthly Rent</TableHead>
              <TableHead>Lease Term</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leasesQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading leases...
                </TableCell>
              </TableRow>
            ) : leasesQuery.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No active leases found.
                </TableCell>
              </TableRow>
            ) : (
              leasesQuery.data?.map((lease) => {
                const isManager = lease.managed_by === account?.id || account?.role === "principal";

                return (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">{lease.tenant_name}</TableCell>
                    <TableCell>
                      <div className="font-medium">{(lease.property as any)?.address}</div>
                      <div className="text-xs text-muted-foreground">
                        {(lease.property as any)?.suburb}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {zar(lease.rent_amount_cents / 100, { decimals: false })}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{dateFmt(lease.start_date)} -</div>
                      <div className="text-sm font-medium">{dateFmt(lease.end_date)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          lease.status === "active"
                            ? "default"
                            : lease.status === "terminated"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {lease.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isManager ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate({ to: `/rentals/${lease.id}` })}
                          className="text-primary hover:text-primary/90 hover:bg-primary/10"
                        >
                          Manage <ArrowRight className="ml-2 size-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate({ to: `/rentals/${lease.id}` })}
                          className="text-muted-foreground"
                        >
                          View <ArrowRight className="ml-2 size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </AppShell>
  );
}
