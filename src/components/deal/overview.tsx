import { GlassCard } from "@/components/ui-kit";
import { AgentAvatar, FicaBadge } from "@/components/badges";
import { userById } from "@/data/state";
import { type Deal } from "@/types";
import { zar, pct, dateFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Home, Ruler, BedDouble, Bath, Car, Building2, ExternalLink } from "lucide-react";

export function DealOverviewTab({ deal }: { deal: Deal }) {
  const property = (deal as Deal & { property?: ReturnType<typeof propertyShape> }).property;
  const gross = Math.round((deal.salePrice * deal.commissionBps) / 10000);

  // Occupational interest accrual
  let occupationalInterest = 0;
  let occupationalDays = 0;
  if (deal.occupationDate && deal.occupationalRent && deal.occupationalRent > 0) {
    const occDate = new Date(deal.occupationDate).getTime();
    const endDate = deal.registeredAt ? new Date(deal.registeredAt).getTime() : Date.now();

    if (endDate > occDate) {
      occupationalDays = Math.floor((endDate - occDate) / 86400000);
      // Daily rent = monthly / (365 / 12) = monthly / 30.416
      const dailyRent = deal.occupationalRent / (365 / 12);
      occupationalInterest = Math.round(occupationalDays * dailyRent);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <GlassCard className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <Home className="size-4 text-primary" /> Property
          </h3>
          <Badge variant="outline">{property?.type}</Badge>
        </div>
        <p className="text-sm font-medium">{property?.address}</p>
        <p className="mb-4 text-sm text-muted-foreground">
          {property?.suburb}, {property?.city}
        </p>
        {property?.schemeName && (
          <p className="mb-4 text-xs text-muted-foreground">Scheme: {property.schemeName}</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={BedDouble} label="Beds" value={property?.beds} />
          <Stat icon={Bath} label="Baths" value={property?.baths} />
          <Stat icon={Car} label="Garages" value={property?.garages} />
          <Stat icon={Ruler} label="Floor" value={`${property?.floorSize} m²`} />
        </div>
        {property && property.erfSize > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Erf size: {property.erfSize} m²</p>
        )}
        {(property?.erfNumber || property?.titleDeedNumber) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {property?.erfNumber ? `Erf: ${property.erfNumber}` : ""}
            {property?.erfNumber && property?.titleDeedNumber ? " · " : ""}
            {property?.titleDeedNumber ? `Title Deed: ${property.titleDeedNumber}` : ""}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <Detail
            label="Sale price"
            value={<span className="money">{zar(deal.salePrice, { decimals: false })}</span>}
          />
          <Detail
            label="Listing price"
            value={<span className="money">{zar(deal.listingPrice, { decimals: false })}</span>}
          />
          <Detail label="Mandate type" value={deal.mandateType} />
          <Detail label="Mandate signed" value={dateFmt(deal.mandateSigned)} />
          <Detail label="Mandate expiry" value={dateFmt(deal.mandateExpiry)} />
          <Detail label="Conveyancer" value={deal.conveyancer} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Financial summary</h3>
        <div className="space-y-3 text-sm">
          <Row label="Sale price" value={zar(deal.salePrice, { decimals: false })} />
          <Row label="Commission rate" value={pct(deal.commissionBps)} />
          <Row label="Gross commission" value={zar(gross, { decimals: false })} strong />
          {deal.occupationalRent && deal.occupationalRent > 0 && (
            <>
              <div className="my-2 border-t border-border/40" />
              <Row
                label="Occupational rent (mo)"
                value={zar(deal.occupationalRent, { decimals: false })}
              />
              {occupationalDays > 0 && (
                <Row
                  label={`Accrued (${occupationalDays} days)`}
                  value={zar(occupationalInterest, { decimals: false })}
                />
              )}
            </>
          )}
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <h3 className="mb-3 font-display text-base font-semibold">Parties</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {deal.parties.map((party) => (
            <div key={party.id} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {party.side}
                </Badge>
                <FicaBadge status={party.fica} />
              </div>
              <p className="truncate text-sm font-medium">{party.name}</p>
              <p className="text-xs text-muted-foreground">
                {party.entityType} {party.maritalStatus ? `· ${party.maritalStatus}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ID/Reg: {party.idNumber || "N/A"} {party.isVatVendor ? "· VAT Vendor" : ""}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {party.email} · {party.mobile}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
          <Building2 className="size-4 text-primary" /> Practitioners
        </h3>
        <div className="space-y-3">
          {deal.practitioners.map((p) => {
            const remote = p as typeof p & { name?: string };
            const user = userById(p.userId) ?? {
              id: p.userId,
              name: remote.name || "Practitioner",
              colour: "#1f7a52",
            };
            return (
              <div key={p.userId} className="flex items-center justify-between gap-2">
                <AgentAvatar user={user as any} showName size={7} />
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{p.role}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {p.splitPct}%
                  </Badge>
                  {p.external && <ExternalLink className="size-3 text-muted-foreground" />}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function propertyShape() {
  return {
    address: "",
    suburb: "",
    city: "",
    type: "",
    beds: 0,
    baths: 0,
    garages: 0,
    floorSize: 0,
    erfSize: 0,
    schemeName: undefined as string | undefined,
    erfNumber: undefined as string | undefined,
    titleDeedNumber: undefined as string | undefined,
  };
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`money ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
