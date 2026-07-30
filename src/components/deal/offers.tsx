import { useState } from "react";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { type Deal } from "@/data/state";
import { zar, dateFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitCompareArrows, Presentation } from "lucide-react";

export function DealOffersTab({ deal }: { deal: any }) {
  const [compare, setCompare] = useState(false);
  const [presenting, setPresenting] = useState(false);

  const offers = (deal.offers || []).map((o: any) => ({
    id: o.id,
    price: o.offer_price_cents,
    deposit: o.deposit_cents,
    bondAmount: o.bond_amount_cents,
    expiry: o.expires_on,
    purchaser: "Purchaser",
    occupationDate: deal.occupation_date,
    status:
      o.status === "accepted"
        ? "Accepted"
        : o.status === "rejected"
          ? "Rejected"
          : o.status === "expired"
            ? "Expired"
            : "Pending",
  }));

  if (offers.length === 0) {
    return (
      <EmptyState
        title="No offers received yet"
        message="Once an offer to purchase is received it will appear here for comparison."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setCompare((c) => !c)}
        >
          <GitCompareArrows className="size-4" /> {compare ? "Card view" : "Compare offers"}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setPresenting(true)}>
          <Presentation className="size-4" /> Seller Presentation
        </Button>
      </div>

      {!compare ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((o: any) => (
            <GlassCard key={o.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{o.purchaser}</p>
                <StatusBadge status={o.status} />
              </div>
              <p className="money mb-1 text-lg font-semibold">
                {zar(o.price, { decimals: false })}
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Deposit: <span className="money">{zar(o.deposit, { decimals: false })}</span>
                </p>
                <p>
                  Bond required:{" "}
                  <span className="money">{zar(o.bondAmount, { decimals: false })}</span>
                </p>
                <p>Occupation: {dateFmt(o.occupationDate)}</p>
                <p>Expires: {dateFmt(o.expiry)}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <OfferComparisonTable offers={offers} />
      )}

      <Dialog open={presenting} onOpenChange={setPresenting}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Seller Presentation — Offer Comparison</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-card p-4">
            <OfferComparisonTable offers={offers} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferComparisonTable({ offers }: { offers: any[] }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Purchaser</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Bond amount</TableHead>
            <TableHead>Occupation</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((o: any) => (
            <TableRow key={o.id}>
              <TableCell className="text-sm">{o.purchaser}</TableCell>
              <TableCell className="money">{zar(o.price, { decimals: false })}</TableCell>
              <TableCell className="money">{zar(o.deposit, { decimals: false })}</TableCell>
              <TableCell className="money">{zar(o.bondAmount, { decimals: false })}</TableCell>
              <TableCell className="text-xs">{dateFmt(o.occupationDate)}</TableCell>
              <TableCell className="text-xs">{dateFmt(o.expiry)}</TableCell>
              <TableCell>
                <StatusBadge status={o.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: Deal["offers"][number]["status"] }) {
  const tone =
    status === "Accepted"
      ? "border-success/30 bg-success/10 text-success"
      : status === "Rejected" || status === "Expired"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-warning/40 bg-warning/15 text-warning";
  return (
    <Badge variant="outline" className={tone}>
      {status}
    </Badge>
  );
}
