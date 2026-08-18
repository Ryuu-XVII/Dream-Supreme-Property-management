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
import {
  FileSignature,
  PlusCircle,
  ArrowRight,
  Globe,
  ExternalLink,
  BedDouble,
  Bath,
  Ruler,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar, dateFmt, relative } from "@/lib/format";
import { useAgencyProperty24Listings } from "@/data/property24";

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

      <Property24ListingsSection />
    </AppShell>
  );
}

/**
 * Live Property24 stock for the agency, synced from each agent's public
 * Property24 profile.
 *
 * Deliberately a separate table from the mandate register above rather than
 * merged into it: a mandate is a signed instruction with a type and an expiry
 * that can be converted into a deal, whereas these are external marketing
 * listings with none of those. Showing them in one table would present
 * unmandated stock as though it were mandated.
 */
function Property24ListingsSection() {
  const { data: listings = [], isLoading } = useAgencyProperty24Listings();

  // Nothing synced yet — stay out of the way rather than showing an empty
  // table for a feature this agency may not use.
  if (!isLoading && listings.length === 0) return null;

  const lastSynced = listings.reduce<string | null>(
    (latest, listing) => (!latest || listing.lastSeenAt > latest ? listing.lastSeenAt : latest),
    null,
  );

  return (
    <GlassCard className="mt-6 p-0">
      <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Globe className="size-4 text-primary" /> Property24 Listings
          </h2>
          <p className="text-xs text-muted-foreground">
            Live stock from your agents&apos; public Property24 profiles.
            {lastSynced ? ` Updated ${relative(lastSynced)}.` : ""} Not mandates — manage those
            above.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {listings.length} listing{listings.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                Loading Property24 listings...
              </TableCell>
            </TableRow>
          ) : (
            listings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {listing.imageUrl && (
                      <img
                        src={listing.imageUrl}
                        alt=""
                        loading="lazy"
                        className="hidden size-12 shrink-0 rounded-md object-cover sm:block"
                      />
                    )}
                    <div>
                      <div className="font-medium">{listing.title ?? "Listing"}</div>
                      <div className="text-xs text-muted-foreground">{listing.location}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{listing.agentName}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      listing.purpose === "sale"
                        ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-600"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    }
                  >
                    {listing.purpose === "sale" ? "For Sale" : "To Rent"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {listing.priceLabel ?? "On request"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                    {listing.bedrooms !== null && (
                      <span className="flex items-center gap-1" title="Bedrooms">
                        <BedDouble className="size-3.5" />
                        {listing.bedrooms}
                      </span>
                    )}
                    {listing.bathrooms !== null && (
                      <span className="flex items-center gap-1" title="Bathrooms">
                        <Bath className="size-3.5" />
                        {listing.bathrooms}
                      </span>
                    )}
                    {listing.sizeLabel && (
                      <span className="flex items-center gap-1" title={listing.sizeKind ?? "Size"}>
                        <Ruler className="size-3.5" />
                        {listing.sizeLabel}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild className="text-primary">
                    <a href={listing.url} target="_blank" rel="noopener noreferrer">
                      View on P24 <ExternalLink className="ml-2 size-3.5" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </GlassCard>
  );
}
