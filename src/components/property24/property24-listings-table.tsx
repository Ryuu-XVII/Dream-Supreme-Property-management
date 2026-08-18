import { useNavigate } from "@tanstack/react-router";
import { Globe, ExternalLink, BedDouble, Bath, Ruler, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relative } from "@/lib/format";
import { useAgencyProperty24Listings } from "@/data/property24";

/**
 * Live Property24 stock for the agency, synced from each agent's public
 * Property24 profile. Shared by the agent Listings page and the admin
 * Property Portfolio Oversight page.
 *
 * Deliberately its own table rather than merged into either page's property
 * or mandate table: a mandate is a signed instruction carrying a type, an
 * expiry and a path to convert into a deal, and an internal property is a
 * record the agency owns. These are external marketing listings with none of
 * those properties, and presenting them together would show unmandated stock
 * as though it were mandated.
 */
export function Property24ListingsTable({ className }: { className?: string }) {
  const { data: listings = [], isLoading } = useAgencyProperty24Listings();
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();

  // Nothing synced yet — stay out of the way rather than showing an empty
  // table for a feature this agency may not use.
  if (!isLoading && listings.length === 0) return null;

  const lastSynced = listings.reduce<string | null>(
    (latest, listing) => (!latest || listing.lastSeenAt > latest ? listing.lastSeenAt : latest),
    null,
  );

  return (
    <GlassCard className={className ? `p-0 ${className}` : "p-0"}>
      <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Globe className="size-4 text-primary" /> Property24 Listings
          </h2>
          <p className="text-xs text-muted-foreground">
            Live stock from your agents&apos; public Property24 profiles.
            {lastSynced ? ` Updated ${relative(lastSynced)}.` : ""} Synced from Property24, not
            mandated stock.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {listings.length} listing{listings.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="overflow-x-auto">
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
                        {/* Plain text: the link to Property24 is an explicit
                            button in the actions column, so linking the title
                            as well would just duplicate it. */}
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
                        <span
                          className="flex items-center gap-1"
                          title={listing.sizeKind ?? "Size"}
                        >
                          <Ruler className="size-3.5" />
                          {listing.sizeLabel}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                        <a href={listing.url} target="_blank" rel="noopener noreferrer">
                          View on P24 <ExternalLink className="ml-1.5 size-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isReadOnly}
                        onClick={() =>
                          navigate({ to: "/deals/new", search: { p24ListingId: listing.id } })
                        }
                        className="text-primary hover:bg-primary/10 hover:text-primary/90"
                      >
                        Convert to Deal <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  );
}
