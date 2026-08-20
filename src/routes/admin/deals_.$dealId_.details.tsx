import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { useDealDetail } from "@/data/deals";
import { useDocuments } from "@/data/documents";
import { getR2FileUrl } from "@/lib/storage";
import { zar, pct, dateFmt, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";

async function download(key: string, filename: string) {
  try {
    const url = await getR2FileUrl(key);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Download failed");
  }
}

export const Route = createFileRoute("/admin/deals_/$dealId_/details")({
  component: DealDetailsPage,
});

function DealDetailsPage() {
  const { dealId } = Route.useParams();
  const { data: deal, isLoading, error } = useDealDetail(dealId);
  const documents = useDocuments(dealId);

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading deal: {(error as Error).message}
      </div>
    );
  }

  if (isLoading || !deal) {
    return <div className="p-8 text-center text-muted-foreground">Loading deal details...</div>;
  }

  const sellers = deal.parties.filter((p: any) => p.side === "Seller");
  const purchasers = deal.parties.filter((p: any) => p.side === "Purchaser");
  const docRows = documents.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/admin/deals" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to Deals Management
        </Link>
      </div>

      <GlassCard>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Deal Summary — {deal.ref}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full written record of this deal, generated {dateFmt(new Date())}.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
          <p>
            <span className="font-semibold text-foreground">Property.</span> This deal concerns{" "}
            {deal.property.address}
            {deal.property.suburb ? `, ${deal.property.suburb}` : ""}
            {deal.property.city ? `, ${deal.property.city}` : ""}, a {deal.property.type} with{" "}
            {deal.property.beds} bedroom{deal.property.beds === 1 ? "" : "s"}, {deal.property.baths}{" "}
            bathroom{deal.property.baths === 1 ? "" : "s"} and {deal.property.garages} garage
            {deal.property.garages === 1 ? "" : "s"}. The erf measures {deal.property.erfSize} m²
            with a floor size of {deal.property.floorSize} m². The property is managed under the{" "}
            {deal.branch} branch.
          </p>

          <p>
            <span className="font-semibold text-foreground">Mandate &amp; Sale.</span> The property
            was listed under a {deal.mandateType} mandate at a listing price of{" "}
            {zar(deal.listingPrice, { decimals: false })}
            {deal.mandateSigned ? `, signed on ${dateFmt(deal.mandateSigned)}` : ""}
            {deal.mandateExpiry ? ` and expiring ${dateFmt(deal.mandateExpiry)}` : ""}. The deal is
            currently at the <span className="font-medium">{deal.stage}</span> stage, with a sale
            price of {zar(deal.salePrice, { decimals: false })}
            {deal.otpSigned ? ` and an offer to purchase signed on ${dateFmt(deal.otpSigned)}` : ""}
            . Commission is agreed at {pct(deal.commissionBps)} of the sale price.
            {deal.cancelled
              ? ` This deal was cancelled on ${
                  deal.cancelled.at ? dateFmt(deal.cancelled.at) : "an unknown date"
                }, reason: ${deal.cancelled.reason}.`
              : ""}
          </p>

          {sellers.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">
                Seller{sellers.length > 1 ? "s" : ""}.
              </span>{" "}
              {sellers
                .map(
                  (s: any) =>
                    `${s.name} (${s.entityType}, FICA: ${s.fica}${s.popia ? ", POPIA consent on file" : ""})`,
                )
                .join("; ")}
              .
            </p>
          )}

          {purchasers.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">
                Purchaser{purchasers.length > 1 ? "s" : ""}.
              </span>{" "}
              {purchasers
                .map(
                  (p: any) =>
                    `${p.name} (${p.entityType}, FICA: ${p.fica}${p.popia ? ", POPIA consent on file" : ""})`,
                )
                .join("; ")}
              .
            </p>
          )}

          {deal.practitioners.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">Practitioners.</span> The deal is
              represented by{" "}
              {deal.practitioners
                .map(
                  (p: any) =>
                    `${p.name} as ${p.role}${p.splitPct ? ` (${p.splitPct}% split)` : ""}${p.external ? " — external" : ""}`,
                )
                .join("; ")}
              . The appointed conveyancer is {deal.conveyancer}.
            </p>
          )}

          {deal.conditions.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">Suspensive Conditions.</span>{" "}
              {deal.conditions
                .map(
                  (c: any) =>
                    `${c.type} (${c.status}${c.dueDate ? `, due ${dateFmt(c.dueDate)}` : ""}, responsible: ${c.responsibleParty})`,
                )
                .join("; ")}
              .
            </p>
          )}

          {deal.bond?.status && deal.bond.status !== "Not applied" && (
            <p>
              <span className="font-semibold text-foreground">Bond.</span> A bond application with
              status "{deal.bond.status}" was
              {deal.bond.institution ? ` submitted to ${deal.bond.institution}` : " submitted"}
              {deal.bond.appliedAt ? ` on ${dateFmt(deal.bond.appliedAt)}` : ""}
              {deal.bond.decidedAt ? `, decided on ${dateFmt(deal.bond.decidedAt)}` : ""}.
            </p>
          )}

          {deal.offers.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">Offers.</span>{" "}
              {deal.offers
                .map(
                  (o: any) =>
                    `${zar(o.price, { decimals: false })} offer (${o.status}), deposit ${zar(o.deposit, { decimals: false })}${o.bondAmount ? `, bond amount ${zar(o.bondAmount, { decimals: false })}` : ""}${o.expiry ? `, expiring ${dateFmt(o.expiry)}` : ""}`,
                )
                .join("; ")}
              .
            </p>
          )}

          {deal.timeline.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">Timeline.</span>{" "}
              {deal.timeline
                .slice()
                .reverse()
                .map(
                  (t: any) =>
                    `On ${dateTimeFmt(t.at)}, ${t.actor} recorded: ${t.action}${t.reason ? ` (${t.reason})` : ""}`,
                )
                .join(". ")}
              .
            </p>
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
          <FileText className="size-4 text-primary" /> Submitted Documents
        </h2>
        {documents.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents…</p>
        ) : docRows.length === 0 ? (
          <EmptyState
            title="No documents"
            message="No documents have been submitted for this deal."
          />
        ) : (
          <div className="space-y-2">
            {docRows.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <FileText className="mr-2 inline size-4 text-primary" />
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.category.replaceAll("_", " ")} · v{item.version} · uploaded by{" "}
                    {item.uploadedBy} · {dateFmt(item.uploadedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void download(item.storageKey, item.name)}
                >
                  <Download className="size-4" /> Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
