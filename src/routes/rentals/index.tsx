import { useState } from "react";
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
import { PlusCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar, dateFmt } from "@/lib/format";
import { LeaseOnboardingWizard } from "@/components/rentals/lease-onboarding-wizard";

export const Route = createFileRoute("/rentals/")({
  validateSearch: (search: Record<string, unknown>): { p24ListingId?: string } => ({
    p24ListingId: search.p24ListingId as string | undefined,
  }),
  component: RentalsDashboard,
});

function RentalsDashboard() {
  const { activeAccount, isReadOnly } = useAuth();
  const navigate = useNavigate();
  const { p24ListingId } = Route.useSearch();
  // Arriving from a "Convert to Lease" action on a Property24 rental listing
  // (src/components/property24/property24-listings-table.tsx) should open
  // straight into lease capture rather than dumping the agent on the list.
  // The wizard doesn't prefill from the listing yet (its Step 1 picks an
  // existing public.property row, whereas a P24 listing hasn't been created
  // as one) -- this just gets them to the right flow instead of the wrong one.
  const [isCreateOpen, setIsCreateOpen] = useState(!!p24ListingId);

  const leasesQuery = useQuery({
    queryKey: ["leases", activeAccount?.agencyId],
    enabled: !!activeAccount?.agencyId || !!activeAccount,
    queryFn: async () => {
      if (!activeAccount?.agencyId) return [];
      const { data, error } = await supabase
        .from("lease")
        .select(
          `
          id,
          monthly_rent_cents,
          start_on,
          end_on,
          status,
          managed_by,
          tenant_party:tenant_party_id(full_name),
          property:property_id(id, address_line, suburb)
        `,
        )
        .eq("agency_id", activeAccount!.agencyId)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback for basic schema fields
        const { data: fallback } = await supabase
          .from("lease")
          .select("*")
          .eq("agency_id", activeAccount!.agencyId);
        return (fallback || []).map((l: any) => ({
          id: l.id,
          tenant_name: l.tenant_name || "Tenant",
          rent_amount_cents: l.monthly_rent_cents || l.rent_amount_cents || 0,
          start_date: l.start_on || l.start_date,
          end_date: l.end_on || l.end_date,
          status: l.status,
          managed_by: l.managed_by,
          property: l.property || { address: "Property #" + l.id.slice(0, 6), suburb: "" },
        }));
      }

      return (data || []).map((l: any) => ({
        id: l.id,
        tenant_name: l.tenant_party?.full_name || l.tenant_name || "Tenant",
        rent_amount_cents: l.monthly_rent_cents || 0,
        start_date: l.start_on,
        end_date: l.end_on,
        status: l.status,
        managed_by: l.managed_by,
        property: {
          address: l.property?.address_line || "Property #" + l.id.slice(0, 6),
          suburb: l.property?.suburb || "",
        },
      }));
    },
  });

  return (
    <AppShell
      title="Rentals Management"
      description="Manage active leases, track tenant invoices, and log maintenance tickets."
      actions={
        <Button disabled={isReadOnly} onClick={() => setIsCreateOpen(true)}>
          <PlusCircle className="mr-2 size-4" />{" "}
          {isReadOnly ? "New Lease (Read-Only)" : "New Lease"}
        </Button>
      }
    >
      <LeaseOnboardingWizard open={isCreateOpen} onOpenChange={setIsCreateOpen} />
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
                const isManager =
                  lease.managed_by === activeAccount?.id || activeAccount?.role === "admin";

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
