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
import { FileSignature, PlusCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar, dateFmt } from "@/lib/format";

export const Route = createFileRoute("/mandates")({
  component: MandatesRegister,
});

function MandatesRegister() {
  const { account } = useAuth();
  const navigate = useNavigate();
  const [openCapture, setOpenCapture] = useState(false);

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
          property:property_id(id, address, suburb)
        `,
        )
        .eq("agency_id", account!.agencyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getExpiryWarning = (expiresOn: string | null) => {
    if (!expiresOn) return null;
    const daysLeft = Math.ceil(
      (new Date(expiresOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft < 0) return <Badge variant="destructive">Expired</Badge>;
    if (daysLeft <= 14)
      return <Badge className="bg-amber-500 hover:bg-amber-600">Expires in {daysLeft} days</Badge>;
    return <span className="text-muted-foreground">{dateFmt(expiresOn)}</span>;
  };

  return (
    <AppShell
      title="Mandate Register"
      description="View and manage all active property mandates."
      actions={
        <Button asChild>
          <Link to="/mandates/new">
            <PlusCircle className="mr-2 size-4" /> New Mandate
          </Link>
        </Button>
      }
    >
      <QuickDealModal
        open={openCapture}
        onOpenChange={setOpenCapture}
        onSuccess={() => mandatesQuery.refetch()}
      />
      <GlassCard className="p-0">
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
            ) : mandatesQuery.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No active mandates found.
                </TableCell>
              </TableRow>
            ) : (
              mandatesQuery.data?.map((mandate) => (
                <TableRow key={mandate.id}>
                  <TableCell>
                    <div className="font-medium">{(mandate.property as any)?.address}</div>
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
                    {zar(mandate.listing_price_cents / 100, { decimals: false })}
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
    </AppShell>
  );
}
