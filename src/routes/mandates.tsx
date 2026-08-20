import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { QuickDealModal } from "@/components/deal/quick-deal-modal";
import { StageBadge } from "@/components/badges";
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
import { Input } from "@/components/ui/input";
import { FileSignature, PlusCircle, ArrowRight, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar, dateFmt } from "@/lib/format";
import { Property24ListingsTable } from "@/components/property24/property24-listings-table";

export const Route = createFileRoute("/mandates")({
  component: MandatesRegister,
});

function getExpiryWarning(expiresOn: string | null) {
  if (!expiresOn) return null;
  const daysLeft = Math.ceil((new Date(expiresOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return <Badge variant="destructive">Expired</Badge>;
  if (daysLeft <= 14)
    return <Badge className="bg-amber-500 hover:bg-amber-600">Expires in {daysLeft} days</Badge>;
  return <span className="text-muted-foreground">{dateFmt(expiresOn)}</span>;
}

function MandatesRegister() {
  const { account, isReadOnly } = useAuth();
  const navigate = useNavigate();
  const [openCapture, setOpenCapture] = useState(false);
  const [search, setSearch] = useState("");

  const mandatesQuery = useQuery({
    queryKey: ["mandates", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mandate")
        .select(
          `
          id,
          mandate_type,
          listing_price_cents,
          signed_on,
          expires_on,
          status,
          property:property_id(id, address_line, suburb)
        `,
        )
        .eq("agency_id", account!.agencyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const query = search.trim().toLowerCase();
  const visibleMandates = query
    ? mandatesQuery.data?.filter((mandate) =>
        [
          (mandate.property as any)?.address_line,
          (mandate.property as any)?.suburb,
          mandate.mandate_type,
          mandate.status,
        ]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(query)),
      )
    : mandatesQuery.data;

  return (
    <AppShell
      title="Mandate Register"
      description="View and manage all active property mandates."
      actions={
        <Button disabled={isReadOnly} onClick={() => setOpenCapture(true)}>
          <PlusCircle className="mr-2 size-4" />{" "}
          {isReadOnly ? "New Listing (Read-Only)" : "New Listing"}
        </Button>
      }
    >
      <QuickDealModal
        open={openCapture}
        onOpenChange={setOpenCapture}
        initialType="mandate"
        onSuccess={() => mandatesQuery.refetch()}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <GlassCard className="p-0">
          <div className="flex items-center justify-between gap-4 border-b border-border p-4">
            <h2 className="font-display text-base font-semibold">Mandates</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mandates..."
                className="h-8 w-48 pl-7 text-xs sm:w-64"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Listing Price</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mandatesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Loading mandates...
                  </TableCell>
                </TableRow>
              ) : visibleMandates?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {query ? "No mandates match your search." : "No active mandates found."}
                  </TableCell>
                </TableRow>
              ) : (
                visibleMandates?.map((mandate) => (
                  <TableRow key={mandate.id}>
                    <TableCell>
                      <div className="font-medium">{(mandate.property as any)?.address_line}</div>
                      <div className="text-xs text-muted-foreground">
                        {(mandate.property as any)?.suburb}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {mandate.mandate_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {zar(mandate.listing_price_cents, { decimals: false })}
                    </TableCell>
                    <TableCell>{getExpiryWarning(mandate.expires_on)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          mandate.status === "active"
                            ? "default"
                            : mandate.status === "sold"
                              ? "secondary"
                              : "destructive"
                        }
                        className="capitalize"
                      >
                        {mandate.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate({ to: "/deals/new", search: { mandateId: mandate.id } })
                        }
                        className="text-primary hover:text-primary/90 hover:bg-primary/10"
                      >
                        Convert to Deal <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </GlassCard>

        <Property24ListingsTable fillHeight />
      </div>
    </AppShell>
  );
}
