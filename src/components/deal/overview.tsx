import { GlassCard } from "@/components/ui-kit";
import { AgentAvatar, FicaBadge } from "@/components/badges";
import { userById } from "@/data/state";
import { type Deal } from "@/types";
import { zar, pct, dateFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Home, Ruler, BedDouble, Bath, Car, Building2, ExternalLink } from "lucide-react";

export function DealOverviewTab({ deal }: { deal: any }) {
  const property = deal.property;
  const mandate = Array.isArray(deal.mandate) ? deal.mandate[0] : deal.mandate;
  const gross = Math.round((deal.sale_price_cents * (mandate?.commission_rate_bps ?? 0)) / 10000);

  // Occupational interest accrual
  let occupationalInterest = 0;
  let occupationalDays = 0;
  if (deal.occupation_date && deal.occupational_rent_cents && deal.occupational_rent_cents > 0) {
    const occDate = new Date(deal.occupation_date).getTime();
    const endDate = deal.registration_date
      ? new Date(deal.registration_date).getTime()
      : Date.now();

    if (endDate > occDate) {
      occupationalDays = Math.floor((endDate - occDate) / 86400000);
      // Daily rent = monthly / (365 / 12) = monthly / 30.416
      const dailyRent = deal.occupational_rent_cents / (365 / 12);
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
          <Badge variant="outline">{property?.property_type}</Badge>
        </div>
        <p className="text-sm font-medium">{property?.address_line}</p>
        <p className="mb-4 text-sm text-muted-foreground">
          {property?.suburb}, {property?.city}
        </p>
        {property?.schemeName && (
          <p className="mb-4 text-xs text-muted-foreground">Scheme: {property.schemeName}</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={BedDouble} label="Beds" value={property?.bedrooms} />
          <Stat icon={Bath} label="Baths" value={property?.bathrooms} />
          <Stat icon={Car} label="Garages" value={property?.garages} />
          <Stat icon={Ruler} label="Floor" value={`${property?.floor_size_sqm} m²`} />
        </div>
        {property && property.erf_size_sqm > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Erf size: {property.erf_size_sqm} m²</p>
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
            value={<span className="money">{zar(deal.sale_price_cents, { decimals: false })}</span>}
          />
          <Detail
            label="Listing price"
            value={
              <span className="money">
                {zar(mandate?.listing_price_cents ?? 0, { decimals: false })}
              </span>
            }
          />
          <Detail label="Mandate type" value={mandate?.mandate_type} />
          <Detail label="Mandate signed" value={dateFmt(mandate?.signed_on ?? deal.created_at)} />
          <Detail label="Mandate expiry" value={dateFmt(mandate?.expires_on)} />
          <Detail label="Conveyancer" value={deal.conveyancer?.name || "Unassigned"} />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Financial summary</h3>
        <div className="space-y-3 text-sm">
          <Row label="Sale price" value={zar(deal.sale_price_cents, { decimals: false })} />
          <Row label="Commission rate" value={pct(mandate?.commission_rate_bps ?? 0)} />
          <Row label="Gross commission" value={zar(gross, { decimals: false })} strong />
          {deal.occupational_rent_cents && deal.occupational_rent_cents > 0 ? (
            <>
              <div className="my-2 border-t border-border/40" />
              <Row
                label="Occupational rent (mo)"
                value={zar(deal.occupational_rent_cents, { decimals: false })}
              />
              {occupationalDays > 0 && (
                <Row
                  label={`Accrued (${occupationalDays} days)`}
                  value={zar(occupationalInterest, { decimals: false })}
                />
              )}
            </>
          ) : null}
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <h3 className="mb-3 font-display text-base font-semibold">Parties</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(deal.parties || []).map((p: any) => (
            <div key={p.party?.id} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {p.role}
                </Badge>
                <FicaBadge
                  status={p.party?.fica_status === "complete" ? "Complete" : "Not Started"}
                />
              </div>
              <p className="truncate text-sm font-medium">{p.party?.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {p.party?.entity_type} {p.party?.maritalStatus ? `· ${p.party?.maritalStatus}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ID/Reg: {p.party?.id_or_reg_number || "N/A"}{" "}
                {p.party?.isVatVendor ? "· VAT Vendor" : ""}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {p.party?.email} · {p.party?.mobile}
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
          {(deal.participants || []).map((p: any) => {
            const user = userById(p.user?.id) ?? {
              id: p.user?.id,
              name: p.user?.full_name || "Practitioner",
              colour: "#1f7a52",
            };
            return (
              <div key={p.user?.id || p.role} className="flex items-center justify-between gap-2">
                <AgentAvatar user={user as any} showName size={7} />
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground capitalize">
                    {p.role.replace("_", " ")}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {p.split_value}%
                  </Badge>
                  {p.is_external && <ExternalLink className="size-3 text-muted-foreground" />}
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
