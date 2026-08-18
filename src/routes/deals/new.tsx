import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { zar, dateFmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Home,
  User,
  FileText,
  Landmark,
  ShieldCheck,
  Upload,
  Plus,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createDeal } from "@/data/deals";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadFileToR2, getUserStorageUsage, recordStorageUsageDelta } from "@/lib/storage";
import {
  createEmptyParty,
  createInitialDealCapture,
  validateDealCapture,
  validateDealStep,
  type DealCaptureForm,
  type DealPartyInput,
} from "@/lib/deal-capture";
import { entityTypeFromDb, ficaStatusFromDb, propertyTypeFromDb } from "@/lib/domain";
import type { EntityType } from "@/types";

/**
 * Property24 size labels look like "1 960 m²", "2 552 m²" or "9.15 ha".
 * Returns square metres, or null when the label cannot be read confidently —
 * a wrong erf size is worse than a blank one on a transfer instruction.
 */
function parseP24Size(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = /([\d\s.,]+)\s*(m²|ha)/i.exec(label);
  if (!match) return null;
  const value = Number(match[1].replace(/[\s,]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return match[2].toLowerCase() === "ha" ? Math.round(value * 10_000) : Math.round(value);
}

// Only the exact strings the province Select offers. A value outside this list
// would leave the field looking empty while actually holding something the
// user never chose.
const P24_PROVINCE_BY_SLUG: Record<string, string> = {
  "eastern-cape": "Eastern Cape",
  "free-state": "Free State",
  gauteng: "Gauteng",
  "kwazulu-natal": "KwaZulu-Natal",
  limpopo: "Limpopo",
  mpumalanga: "Mpumalanga",
  "north-west": "North West",
  "northern-cape": "Northern Cape",
  "western-cape": "Western Cape",
};

const titleCaseSlug = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Property24 listing URLs carry the location the tile itself does not:
 * /for-sale/{suburb}/{city}/{province}/{areaId}/{listingId}. That is the only
 * published source for city and province, so it is worth reading.
 */
function parseP24ListingUrl(url: string | null | undefined): {
  suburb?: string;
  city?: string;
  province?: string;
} {
  if (!url) return {};
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    // [for-sale|to-rent, suburb, city, province, areaId, listingId]
    if (parts.length < 6) return {};
    return {
      suburb: titleCaseSlug(parts[1]),
      city: titleCaseSlug(parts[2]),
      province: P24_PROVINCE_BY_SLUG[parts[3].toLowerCase()],
    };
  } catch {
    return {};
  }
}

/**
 * Best-effort property type from a Property24 tile title such as
 * "4 Bedroom House" or "Commercial Property". Returns null when nothing
 * matches, so the form keeps its own default rather than being told something
 * untrue.
 */
function propertyTypeFromP24Title(
  title: string | null | undefined,
): DealCaptureForm["propertyType"] | null {
  const text = (title ?? "").toLowerCase();
  if (!text) return null;
  if (text.includes("farm") || text.includes("smallholding")) return "Farm";
  if (text.includes("commercial") || text.includes("office") || text.includes("retail"))
    return "Commercial";
  if (text.includes("industrial") || text.includes("warehouse")) return "Industrial";
  if (text.includes("vacant land") || text.includes("plot") || text.includes("stand"))
    return "Vacant Land";
  if (text.includes("townhouse")) return "Townhouse";
  if (text.includes("apartment") || text.includes("flat")) return "Sectional Title";
  if (text.includes("house")) return "Freehold House";
  return null;
}

export const Route = createFileRoute("/deals/new")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { mandateId?: string; p24ListingId?: string } => ({
    mandateId: search.mandateId as string | undefined,
    p24ListingId: search.p24ListingId as string | undefined,
  }),
  head: () => ({
    meta: [
      { title: "New Deal Wizard | Dream Supreme Properties" },
      {
        name: "description",
        content: "Create a new property sales deal and capture initial suspensive conditions.",
      },
    ],
  }),
  component: NewDealPage,
});

const STEPS = [
  { id: 1, name: "Property & Mandate", icon: Home },
  { id: 2, name: "Parties (Seller & Buyer)", icon: User },
  { id: 3, name: "OTP & Conveyancer", icon: FileText },
  { id: 4, name: "Suspensive Conditions", icon: Landmark },
  { id: 5, name: "Documents", icon: Upload },
  { id: 6, name: "Review & Create", icon: ShieldCheck },
];

function FilePicker({
  category,
  files,
  setFiles,
}: {
  category: string;
  files: Record<string, File | null>;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
}) {
  return (
    <label className="flex w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
      <Upload className="mr-2 size-4" />
      <span className="truncate">{files[category]?.name || "Choose PDF or image"}</span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        className="sr-only"
        onChange={(event) =>
          setFiles((current) => ({
            ...current,
            [category]: event.target.files?.[0] || null,
          }))
        }
      />
    </label>
  );
}

const ENTITY_TYPES: EntityType[] = [
  "Natural Person",
  "Company",
  "Close Corporation",
  "Trust",
  "Deceased Estate",
];

function PartyEditor({
  title,
  party,
  purchaser,
  canRemove,
  onChange,
  onRemove,
}: {
  title: string;
  party: DealPartyInput;
  purchaser: boolean;
  canRemove: boolean;
  onChange: (field: keyof DealPartyInput, value: DealPartyInput[keyof DealPartyInput]) => void;
  onRemove: () => void;
}) {
  const naturalPerson = party.entityType === "Natural Person";
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-semibold text-primary">{title}</h4>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="mr-1 size-4" /> Remove
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Full legal name / registered entity *</Label>
          <Input value={party.name} onChange={(e) => onChange("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Entity type *</Label>
          <Select value={party.entityType} onValueChange={(value) => onChange("entityType", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ID / passport / registration number *</Label>
          <Input value={party.idNumber} onChange={(e) => onChange("idNumber", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Party share (%) *</Label>
          <Input
            type="number"
            min="0.0001"
            max="100"
            step="0.0001"
            value={party.sharePercent}
            onChange={(e) => onChange("sharePercent", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Income tax number</Label>
          <Input value={party.taxNumber} onChange={(e) => onChange("taxNumber", e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Required for entities and natural persons from R2 million.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={party.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile</Label>
          <Input value={party.mobile} onChange={(e) => onChange("mobile", e.target.value)} />
        </div>
        {naturalPerson ? (
          <>
            <div className="space-y-1.5">
              <Label>Date of birth *</Label>
              <Input
                type="date"
                value={party.dateOfBirth}
                onChange={(e) => onChange("dateOfBirth", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Marital status *</Label>
              <Select
                value={party.maritalStatus}
                onValueChange={(value) => onChange("maritalStatus", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Not married / single</SelectItem>
                  <SelectItem value="Married in Community of Property">
                    Married in community of property
                  </SelectItem>
                  <SelectItem value="Married out of Community of Property">
                    Married out of community of property
                  </SelectItem>
                  <SelectItem value="Married by Foreign Law">Married under foreign law</SelectItem>
                  <SelectItem value="Divorced">Divorced</SelectItem>
                  <SelectItem value="Widowed">Widowed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Input
                value={party.nationality}
                onChange={(e) => onChange("nationality", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={party.isSaResident}
                onCheckedChange={(value) => onChange("isSaResident", value)}
              />
              <Label>South African resident</Label>
            </div>
            {!party.isSaResident && (
              <>
                <div className="space-y-1.5">
                  <Label>Passport number *</Label>
                  <Input
                    value={party.passportNumber}
                    onChange={(e) => onChange("passportNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Passport issuing country *</Label>
                  <Input
                    value={party.passportCountry}
                    onChange={(e) => onChange("passportCountry", e.target.value)}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Authorised representative *</Label>
              <Input
                value={party.representativeName}
                onChange={(e) => onChange("representativeName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Representative capacity *</Label>
              <Input
                placeholder="Trustee, director, executor..."
                value={party.representativeCapacity}
                onChange={(e) => onChange("representativeCapacity", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Beneficial owners / controlling persons *</Label>
              <Textarea
                value={party.beneficialOwnerDetails}
                onChange={(e) => onChange("beneficialOwnerDetails", e.target.value)}
              />
            </div>
          </>
        )}
        {purchaser && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Source of purchase funds *</Label>
            <Textarea
              placeholder="Home loan, savings, sale proceeds, gift, other — describe and identify origin"
              value={party.sourceOfFunds}
              onChange={(e) => onChange("sourceOfFunds", e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>FICA status</Label>
          <Select value={party.fica} onValueChange={(value) => onChange("fica", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Complete">Complete (verified)</SelectItem>
              <SelectItem value="Partial">Pending documents</SelectItem>
              <SelectItem value="Not Started">Not started</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>FICA risk rating</Label>
          <Select value={party.riskRating} onValueChange={(value) => onChange("riskRating", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3 pt-2 sm:col-span-2">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={party.isVatVendor}
              onCheckedChange={(value) => onChange("isVatVendor", value === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label>VAT vendor</Label>
              <p className="text-xs text-muted-foreground">
                This party is registered for VAT with SARS. Required if this is a VAT sale — at
                least one seller must be a VAT vendor.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              checked={party.popiaConsent}
              onCheckedChange={(value) => onChange("popiaConsent", value === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label>POPIA processing notice acknowledged</Label>
              <p className="text-xs text-muted-foreground">
                Confirms this party was given the POPIA notice explaining how their personal
                information will be processed for this transaction, and consented to it.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              checked={party.sanctionsScreened}
              onCheckedChange={(value) => onChange("sanctionsScreened", value === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label>TFS / sanctions screening completed *</Label>
              <p className="text-xs text-muted-foreground">
                Confirms this party has actually been checked against Targeted Financial Sanctions
                (TFS) and sanctions watchlists, as FICA requires before a deal can proceed. Only
                check this once that check has genuinely been done — the deal cannot be submitted
                without it.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              checked={party.isProminentPerson}
              onCheckedChange={(value) => onChange("isProminentPerson", value === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label>Domestic/foreign prominent person</Label>
              <p className="text-xs text-muted-foreground">
                This party is a Politically Exposed Person (PEP) — a prominent public official,
                their family member, or close associate. Triggers enhanced FICA due diligence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DOCUMENT_LABELS: Record<string, string> = {
  mandate: "Signed mandate",
  otp: "Signed OTP",
  property_disclosure: "PPRA disclosure",
  seller_fica: "Seller FICA",
  purchaser_fica: "Purchaser FICA",
  title_deed: "Title deed",
  municipal_account: "Municipal account",
};

function ReviewSection({
  title,
  span,
  children,
}: {
  title: string;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-border p-4 space-y-2.5 ${span ? "sm:col-span-2" : ""}`}
    >
      <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function ReviewFlag({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {on ? (
        <CheckCircle2 className="size-3.5 text-success" />
      ) : (
        <XCircle className="size-3.5 text-muted-foreground/50" />
      )}
      <span className={on ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function ReviewPartyCard({
  party,
  index,
  purchaser,
}: {
  party: DealPartyInput;
  index: number;
  purchaser: boolean;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {party.name || `${purchaser ? "Purchaser" : "Seller"} ${index + 1}`}
        </p>
        <Badge variant="outline" className="text-xs">
          {party.sharePercent}% share
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{party.entityType}</span>
        <span className="text-right">{party.idNumber || "No ID/reg number"}</span>
        <span>{party.email || "No email"}</span>
        <span className="text-right">{party.mobile || "No mobile"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-2">
        <Badge
          variant="outline"
          className={
            party.fica === "Complete"
              ? "border-success/30 bg-success/10 text-success"
              : "border-amber-500/30 bg-amber-500/10 text-amber-500"
          }
        >
          FICA: {party.fica}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Risk: {party.riskRating}
        </Badge>
        <ReviewFlag label="VAT vendor" on={party.isVatVendor} />
        <ReviewFlag label="POPIA acknowledged" on={party.popiaConsent} />
        <ReviewFlag label="Sanctions screened" on={party.sanctionsScreened} />
        {party.isProminentPerson && <ReviewFlag label="Prominent person" on={true} />}
      </div>
    </div>
  );
}

function NewDealPage() {
  const { account } = useAuth();
  // Mirrors enforce_admin_only_commission_rate in the database: agents may
  // capture a deal but not choose what the agency earns on it.
  const canEditCommission = (account?.role ?? "").toLowerCase().includes("admin");
  const navigate = useNavigate();
  const { mandateId, p24ListingId } = Route.useSearch();
  const [step, setStep] = useState(1);
  const [baselineFiles, setBaselineFiles] = useState<Record<string, File | null>>({
    mandate: null,
    otp: null,
    property_disclosure: null,
    seller_fica: null,
    purchaser_fica: null,
    title_deed: null,
    municipal_account: null,
  });
  const { data: referenceData } = useQuery({
    queryKey: ["deal-form-reference-data"],
    queryFn: async () => {
      const [usersResult, conveyancersResult] = await Promise.all([
        supabase
          .from("user_account")
          .select("id, full_name, role, branch:branch_id(name)")
          .eq("status", "active")
          .in("role", ["admin", "agent"])
          .order("full_name"),
        supabase.from("conveyancer_firm").select("id, name").order("name"),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (conveyancersResult.error) throw conveyancersResult.error;
      return {
        users: (usersResult.data || []).map((user: any) => ({
          id: user.id,
          name: user.full_name,
          role: user.role,
          branch: user.branch?.name || "Unassigned",
        })),
        conveyancerFirms: conveyancersResult.data || [],
      };
    },
  });
  const users = referenceData?.users || [];
  const conveyancerFirms = referenceData?.conveyancerFirms || [];

  const { data: sourceMandate } = useQuery({
    queryKey: ["mandate-for-conversion", mandateId],
    enabled: !!mandateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mandate")
        .select(
          `
          id, mandate_type, listing_price_cents, commission_rate_bps, signed_on, expires_on,
          listing_agent_id,
          property:property_id (
            address_line, suburb, city, province, postal_code, erf_number, title_deed_number,
            property_type, is_sectional_title, bedrooms, bathrooms, garages, erf_size_sqm,
            floor_size_sqm, legal_description, deeds_office, property_use, is_improved
          ),
          seller:seller_party_id (
            full_name, id_or_reg_number, email, mobile, entity_type, fica_status, popia_consent_at
          )
        `,
        )
        .eq("id", mandateId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: sourceP24Listing } = useQuery({
    queryKey: ["p24-listing-for-conversion", p24ListingId],
    enabled: !!p24ListingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_property24_listing")
        .select(
          `id, title, location, excerpt, url, price_zar, bedrooms, bathrooms,
           parking, size_label, size_kind, user_account_id`,
        )
        .eq("id", p24ListingId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [formData, setFormData] = useState<DealCaptureForm>(createInitialDealCapture);
  const prefilledMandateId = useRef<string | null>(null);
  const prefilledP24Id = useRef<string | null>(null);

  // A Property24 listing carries far less than a mandate: a suburb but no
  // street address, no erf or title deed, no seller, no mandate dates. Fill in
  // what is genuinely there and leave the rest blank rather than guessing —
  // these fields end up on legal documents.
  useEffect(() => {
    if (!sourceP24Listing || !p24ListingId || prefilledP24Id.current === p24ListingId) return;
    prefilledP24Id.current = p24ListingId;

    const price = sourceP24Listing.price_zar ? String(Number(sourceP24Listing.price_zar)) : "";
    const size = parseP24Size(sourceP24Listing.size_label);

    const location = parseP24ListingUrl(sourceP24Listing.url);
    const propertyType = propertyTypeFromP24Title(sourceP24Listing.title);

    setFormData((prev) => ({
      ...prev,
      // `location` on the tile is the nicely-cased suburb ("Strydfontein AH");
      // the URL slug is only the fallback.
      suburb: sourceP24Listing.location || location.suburb || prev.suburb,
      city: location.city || prev.city,
      province: location.province || prev.province,
      propertyType: propertyType ?? prev.propertyType,
      propertyUse:
        propertyType === "Vacant Land"
          ? "Vacant land"
          : propertyType === "Commercial" || propertyType === "Industrial"
            ? "Business use"
            : prev.propertyUse,
      isImproved: propertyType === "Vacant Land" ? false : prev.isImproved,
      beds: sourceP24Listing.bedrooms ?? prev.beds,
      baths: sourceP24Listing.bathrooms ?? prev.baths,
      // Property24 counts "Parking Spaces", which lumps garages and open bays
      // together, so this is the closest available figure rather than an exact
      // garage count — worth a glance before sign-off.
      garages: sourceP24Listing.parking ?? prev.garages,
      // "Floor Size" and "Erf Size" are different measurements; only fill the
      // one Property24 actually labelled.
      floorSize:
        size !== null && sourceP24Listing.size_kind === "Floor Size" ? size : prev.floorSize,
      erfSize: size !== null && sourceP24Listing.size_kind === "Erf Size" ? size : prev.erfSize,
      listingPrice: price || prev.listingPrice,
      salePrice: price || prev.salePrice,
      agentId: sourceP24Listing.user_account_id || prev.agentId,
    }));

    toast.success("Property24 listing loaded", {
      description:
        "Street address, erf number and seller details are not published on Property24 — please complete them.",
    });
  }, [sourceP24Listing, p24ListingId]);

  useEffect(() => {
    if (!sourceMandate || !mandateId || prefilledMandateId.current === mandateId) return;
    prefilledMandateId.current = mandateId;
    const property = sourceMandate.property || {};
    const seller = sourceMandate.seller;
    const listingPriceZar = String((sourceMandate.listing_price_cents || 0) / 100);

    setFormData((prev) => ({
      ...prev,
      address: property.address_line || prev.address,
      suburb: property.suburb || prev.suburb,
      city: property.city || prev.city,
      province: property.province || prev.province,
      postalCode: property.postal_code || prev.postalCode,
      legalDescription:
        property.legal_description ||
        (property.erf_number
          ? `Erf ${property.erf_number}, ${property.address_line || ""}, ${property.suburb || ""}, ${property.city || ""}`.trim()
          : prev.legalDescription),
      deedsOffice: property.deeds_office || prev.deedsOffice,
      erfNumber: property.erf_number || prev.erfNumber,
      titleDeedNumber: property.title_deed_number || prev.titleDeedNumber,
      propertyType:
        (propertyTypeFromDb[property.property_type] as DealCaptureForm["propertyType"]) ||
        prev.propertyType,
      propertyUse: property.property_use || prev.propertyUse,
      isImproved: property.is_improved ?? prev.isImproved,
      beds: property.bedrooms ?? prev.beds,
      baths: property.bathrooms ?? prev.baths,
      garages: property.garages ?? prev.garages,
      erfSize: property.erf_size_sqm ?? prev.erfSize,
      floorSize: property.floor_size_sqm ?? prev.floorSize,
      mandateType: (sourceMandate.mandate_type?.replace(/^./, (v: string) => v.toUpperCase()) ||
        prev.mandateType) as DealCaptureForm["mandateType"],
      listingPrice: listingPriceZar,
      salePrice: listingPriceZar,
      commissionBps: String(sourceMandate.commission_rate_bps ?? prev.commissionBps),
      mandateSigned: sourceMandate.signed_on || prev.mandateSigned,
      mandateExpiry: sourceMandate.expires_on || prev.mandateExpiry,
      agentId: sourceMandate.listing_agent_id || prev.agentId,
      sellers: seller
        ? [
            {
              ...createEmptyParty(),
              name: seller.full_name || "",
              idNumber: seller.id_or_reg_number || "",
              email: seller.email || "",
              mobile: seller.mobile || "",
              entityType: entityTypeFromDb[seller.entity_type] || "Natural Person",
              fica: ficaStatusFromDb[seller.fica_status] || "Not Started",
              popiaConsent: !!seller.popia_consent_at,
            },
          ]
        : prev.sellers,
    }));
    toast.success("Mandate details loaded — review and complete the remaining deal fields.");
  }, [sourceMandate, mandateId]);

  const updateForm = <Key extends keyof DealCaptureForm>(key: Key, val: DealCaptureForm[Key]) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const updateParty = (
    side: "sellers" | "purchasers",
    index: number,
    field: keyof DealPartyInput,
    value: DealPartyInput[keyof DealPartyInput],
  ) => {
    setFormData((current) => ({
      ...current,
      [side]: current[side].map((party, partyIndex) =>
        partyIndex === index ? { ...party, [field]: value } : party,
      ),
    }));
  };

  const addParty = (side: "sellers" | "purchasers") =>
    setFormData((current) => {
      const count = current[side].length + 1;
      const equalShare = String(Math.round((100 / count) * 10000) / 10000);
      return {
        ...current,
        [side]: [...current[side], createEmptyParty()].map((party) => ({
          ...party,
          sharePercent: equalShare,
        })),
      };
    });
  const removeParty = (side: "sellers" | "purchasers", index: number) =>
    setFormData((current) => {
      const remaining = current[side].filter((_, partyIndex) => partyIndex !== index);
      const equalShare = String(Math.round((100 / remaining.length) * 10000) / 10000);
      return {
        ...current,
        [side]: remaining.map((party) => ({ ...party, sharePercent: equalShare })),
      };
    });

  const handleNext = () => {
    const errors = validateDealStep(formData, step);
    if (errors.length > 0) {
      toast.error(errors[0], {
        description:
          errors.length > 1 ? `${errors.length - 1} more item(s) need attention.` : undefined,
      });
      return;
    }
    if (step < STEPS.length) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    try {
      if (!account) throw new Error("Your agency account is unavailable.");
      const errors = validateDealCapture(formData);
      if (errors.length > 0) throw new Error(errors[0]);
      if (!baselineFiles.mandate || !baselineFiles.otp || !baselineFiles.property_disclosure) {
        throw new Error(
          "The signed mandate, signed OTP, and PPRA condition disclosure files are required.",
        );
      }
      toast.loading("Creating deal...", { id: "create-deal" });
      const dealId = await createDeal({
        ...formData,
        agentId: formData.agentId || users[0]?.id,
        sourceMandateId: mandateId,
      });
      try {
        const usage = await getUserStorageUsage(account.id);
        let runningUsedBytes = usage.usedBytes;
        for (const [category, file] of Object.entries(baselineFiles)) {
          if (!file) continue;
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
          const storageKey = await uploadFileToR2(
            file,
            `${account.agencyId}/deals/${dealId}/${crypto.randomUUID()}-${safeName}`,
            { currentStorageUsedBytes: runningUsedBytes, storageLimitBytes: usage.limitBytes },
          );
          await recordStorageUsageDelta(account.id, file.size);
          runningUsedBytes += file.size;
          const { data: documentRecord, error } = await supabase
            .from("document")
            .insert({
              agency_id: account.agencyId,
              deal_id: dealId,
              category,
              filename: file.name,
              storage_key: storageKey,
              mime_type: file.type,
              size_bytes: file.size,
              uploaded_by: account.id,
            })
            .select("id")
            .single();
          if (error) throw error;
          const { error: checklistError } = await supabase
            .from("checklist_item")
            .update({
              is_complete: true,
              document_id: documentRecord.id,
              completed_on: new Date().toISOString().split("T")[0],
              completed_by: account.id,
            })
            .eq("deal_id", dealId)
            .eq("category", category);
          if (checklistError) throw checklistError;
        }
      } catch (uploadError: any) {
        toast.warning("Deal created, but a document upload failed", {
          id: "create-deal",
          description: uploadError.message,
        });
        navigate({ to: "/deals/$dealId", params: { dealId } });
        return;
      }
      toast.success("Deal created successfully!", { id: "create-deal" });
      navigate({ to: "/deals/$dealId", params: { dealId } });
    } catch (err: any) {
      toast.error(`Failed to create deal: ${err.message}`, { id: "create-deal" });
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/pipeline"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back to Pipeline
            </Link>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Create New Deal</h1>
            <p className="text-sm text-muted-foreground">
              Capture property, mandate, transaction parties, and suspensive condition deadlines.
            </p>
          </div>
        </div>

        {/* Stepper Header */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card/60 p-3 backdrop-blur-md sm:grid-cols-6">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!isDone}
                onClick={() => setStep(s.id)}
                aria-current={isActive ? "step" : undefined}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors ${
                  isDone ? "cursor-pointer hover:bg-muted" : "cursor-default"
                }`}
              >
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                      : isDone
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                </div>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Form Container */}
        <GlassCard>
          {/* Step 1: Property & Mandate */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 1: Property & Mandate Details
                </h3>
                <p className="text-xs text-muted-foreground">
                  Capture the physical address, deeds-search description, ownership, and mandate.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Street Address *</Label>
                  <Input
                    placeholder="e.g. 42 Sandton Drive"
                    value={formData.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Suburb *</Label>
                  <Input
                    placeholder="e.g. Morningside"
                    value={formData.suburb}
                    onChange={(e) => updateForm("suburb", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City *</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => updateForm("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Province *</Label>
                  <Select
                    value={formData.province}
                    onValueChange={(value) => updateForm("province", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Eastern Cape",
                        "Free State",
                        "Gauteng",
                        "KwaZulu-Natal",
                        "Limpopo",
                        "Mpumalanga",
                        "North West",
                        "Northern Cape",
                        "Western Cape",
                      ].map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Postal Code</Label>
                  <Input
                    placeholder="e.g. 2196"
                    value={formData.postalCode}
                    onChange={(e) => updateForm("postalCode", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Full deeds-search property description *</Label>
                    {!formData.legalDescription.trim() &&
                      (formData.erfNumber.trim() || formData.address.trim()) && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() =>
                            updateForm(
                              "legalDescription",
                              `Erf ${formData.erfNumber || "[erf number]"}, ${formData.address}, ${formData.suburb}, ${formData.city}`.trim(),
                            )
                          }
                        >
                          Use suggested description
                        </button>
                      )}
                  </div>
                  <Textarea
                    placeholder="Erf / unit, township or scheme, registration division, province and extent"
                    value={formData.legalDescription}
                    onChange={(e) => updateForm("legalDescription", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Deeds office</Label>
                  <Input
                    placeholder="Pretoria, Johannesburg, Cape Town..."
                    value={formData.deedsOffice}
                    onChange={(e) => updateForm("deedsOffice", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Erf Number</Label>
                  <Input
                    placeholder="e.g. 1234/1"
                    value={formData.erfNumber}
                    onChange={(e) => updateForm("erfNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Current Title Deed Number *</Label>
                  <Input
                    placeholder="e.g. T12345/2020"
                    value={formData.titleDeedNumber}
                    onChange={(e) => updateForm("titleDeedNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Property Type</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(v) =>
                      updateForm("propertyType", v as DealCaptureForm["propertyType"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Freehold House">Freehold House</SelectItem>
                      <SelectItem value="Sectional Title">Sectional Title</SelectItem>
                      <SelectItem value="Estate House">Estate House</SelectItem>
                      <SelectItem value="Townhouse">Townhouse</SelectItem>
                      <SelectItem value="Vacant Land">Vacant land</SelectItem>
                      <SelectItem value="Farm">Farm</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Industrial">Industrial</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Current property use</Label>
                  <Select
                    value={formData.propertyUse}
                    onValueChange={(value) => updateForm("propertyUse", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Primary residence">Primary residence</SelectItem>
                      <SelectItem value="Let as residence">Let as residence</SelectItem>
                      <SelectItem value="Business use">Business use</SelectItem>
                      <SelectItem value="Vacant land">Vacant land</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ownership share being transferred (%) *</Label>
                  <Input
                    type="number"
                    min="0.0001"
                    max="100"
                    step="0.0001"
                    value={formData.transferSharePercent}
                    onChange={(e) => updateForm("transferSharePercent", e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={formData.isImproved}
                    onCheckedChange={(value) => updateForm("isImproved", value)}
                  />
                  <Label>Improved property</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Beds</Label>
                    <Input
                      type="number"
                      value={formData.beds}
                      onChange={(e) => updateForm("beds", +e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Baths</Label>
                    <Input
                      type="number"
                      value={formData.baths}
                      onChange={(e) => updateForm("baths", +e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Garages</Label>
                    <Input
                      type="number"
                      value={formData.garages}
                      onChange={(e) => updateForm("garages", +e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Erf size m²</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.erfSize}
                      onChange={(e) => updateForm("erfSize", +e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Floor size m²</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.floorSize}
                      onChange={(e) => updateForm("floorSize", +e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Seller acquired property on</Label>
                  <Input
                    type="date"
                    value={formData.sellerAcquiredOn}
                    onChange={(e) => updateForm("sellerAcquiredOn", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Seller's original purchase price (ZAR)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.sellerOriginalPurchasePrice}
                    onChange={(e) => updateForm("sellerOriginalPurchasePrice", e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 border-t border-border pt-4">
                  <h4 className="mb-3 font-display text-sm font-semibold">Mandate Setup</h4>
                </div>

                <div className="space-y-1.5">
                  <Label>Mandate Type</Label>
                  <Select
                    value={formData.mandateType}
                    onValueChange={(v) =>
                      updateForm("mandateType", v as DealCaptureForm["mandateType"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sole">Sole Mandate</SelectItem>
                      <SelectItem value="Joint">Joint Mandate</SelectItem>
                      <SelectItem value="Open">Open Mandate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mandate Signed Date *</Label>
                  <Input
                    type="date"
                    value={formData.mandateSigned}
                    onChange={(e) => updateForm("mandateSigned", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Listing Price (ZAR) *</Label>
                  <Input
                    type="number"
                    placeholder="2500000"
                    value={formData.listingPrice}
                    onChange={(e) => updateForm("listingPrice", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Commission Rate (% or basis points)</Label>
                  {/* Only administrators set commission. The database enforces
                      this too (enforce_admin_only_commission_rate), so an agent
                      submitting a rate has it replaced by the agency default
                      rather than silently applied — showing it read-only keeps
                      the form honest about what will actually be saved. */}
                  {canEditCommission ? (
                    <Select
                      value={formData.commissionBps}
                      onValueChange={(v) => updateForm("commissionBps", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500">5.0% (500 bps)</SelectItem>
                        <SelectItem value="550">5.5% (550 bps)</SelectItem>
                        <SelectItem value="600">6.0% (600 bps)</SelectItem>
                        <SelectItem value="700">7.0% (700 bps)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Input
                        readOnly
                        value={`${(Number(formData.commissionBps) / 100).toFixed(2)}%`}
                        className="cursor-not-allowed bg-muted/60 opacity-70"
                      />
                      <p className="text-xs text-muted-foreground">
                        Set by your agency&apos;s commission rules. Contact an administrator to
                        change it.
                      </p>
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Mandate Expiry Date</Label>
                  <Input
                    type="date"
                    value={formData.mandateExpiry}
                    onChange={(e) => updateForm("mandateExpiry", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Parties */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">Step 2: Transaction Parties</h3>
                <p className="text-xs text-muted-foreground">
                  Capture Seller and Purchaser contact details and FICA status.
                </p>
              </div>

              <div className="space-y-4">
                {formData.sellers.map((party, index) => (
                  <PartyEditor
                    key={party._key}
                    title={`Seller / transferor ${index + 1}`}
                    party={party}
                    purchaser={false}
                    canRemove={formData.sellers.length > 1}
                    onChange={(field, value) => updateParty("sellers", index, field, value)}
                    onRemove={() => removeParty("sellers", index)}
                  />
                ))}
                <Button type="button" variant="outline" onClick={() => addParty("sellers")}>
                  <Plus className="mr-1 size-4" /> Add seller / co-owner
                </Button>
              </div>

              <div className="space-y-4">
                {formData.purchasers.map((party, index) => (
                  <PartyEditor
                    key={party._key}
                    title={`Purchaser / transferee ${index + 1}`}
                    party={party}
                    purchaser
                    canRemove={formData.purchasers.length > 1}
                    onChange={(field, value) => updateParty("purchasers", index, field, value)}
                    onRemove={() => removeParty("purchasers", index)}
                  />
                ))}
                <Button type="button" variant="outline" onClick={() => addParty("purchasers")}>
                  <Plus className="mr-1 size-4" /> Add purchaser / co-buyer
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: OTP & Conveyancer */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 3: OTP & Financial Summary
                </h3>
                <p className="text-xs text-muted-foreground">
                  Capture the signed agreement's financial, tax, occupation, and handover terms.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Agreed Sale Price (ZAR) *</Label>
                  <Input
                    type="number"
                    value={formData.salePrice}
                    onChange={(e) => updateForm("salePrice", e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    checked={formData.isVatSale}
                    onCheckedChange={(v) => updateForm("isVatSale", v)}
                  />
                  <Label>Sale is subject to VAT (Zero transfer duty)</Label>
                </div>
                <div className="space-y-1.5">
                  <Label>Effective date / date of last signature *</Label>
                  <Input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => updateForm("effectiveDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Offer expiry date</Label>
                  <Input
                    type="date"
                    value={formData.offerExpiresOn}
                    onChange={(e) => updateForm("offerExpiresOn", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Deposit (ZAR)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.depositAmount}
                    onChange={(e) => updateForm("depositAmount", e.target.value)}
                  />
                </div>
                {Number(formData.depositAmount) > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Deposit due date *</Label>
                      <Input
                        type="date"
                        value={formData.depositDueOn}
                        onChange={(e) => updateForm("depositDueOn", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Deposit stakeholder *</Label>
                      <Input
                        value={formData.depositHolder}
                        onChange={(e) => updateForm("depositHolder", e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label>Balance payment / guarantee method *</Label>
                  <Input
                    value={formData.balancePaymentMethod}
                    onChange={(e) => updateForm("balancePaymentMethod", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Occupation date</Label>
                  <Input
                    type="date"
                    value={formData.occupationDate}
                    onChange={(e) => updateForm("occupationDate", e.target.value)}
                  />
                </div>
                {formData.occupationDate && (
                  <div className="space-y-1.5">
                    <Label>Monthly occupational rent (ZAR)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.occupationalRent}
                      onChange={(e) => updateForm("occupationalRent", e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Sale method</Label>
                  <Select
                    value={formData.saleMethod}
                    onValueChange={(value) => updateForm("saleMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Private treaty">Private treaty</SelectItem>
                      <SelectItem value="Public auction">Public auction</SelectItem>
                      <SelectItem value="Sale in execution">Sale in execution</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Appointed Conveyancer Firm</Label>
                  <Select
                    value={formData.conveyancer}
                    onValueChange={(v) => updateForm("conveyancer", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conveyancerFirms.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Conveyancer reference</Label>
                  <Input
                    value={formData.conveyancerReference}
                    onChange={(e) => updateForm("conveyancerReference", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Lead Listing Practitioner</Label>
                  <Select value={formData.agentId} onValueChange={(v) => updateForm("agentId", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.role} — {u.branch})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.vatInclusive}
                      onCheckedChange={(value) => updateForm("vatInclusive", value)}
                    />
                    <Label>Price includes VAT</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.partiesConnected}
                      onCheckedChange={(value) => updateForm("partiesConnected", value)}
                    />
                    <Label>Seller and purchaser are connected persons</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.sellerIsNonResident}
                      onCheckedChange={(value) => updateForm("sellerIsNonResident", value)}
                    />
                    <Label>Non-resident seller (section 35A review)</Label>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Fixtures included</Label>
                  <Textarea
                    value={formData.fixturesIncluded}
                    onChange={(e) => updateForm("fixturesIncluded", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Fixtures excluded</Label>
                  <Textarea
                    value={formData.fixturesExcluded}
                    onChange={(e) => updateForm("fixturesExcluded", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Special terms and conditions</Label>
                  <Textarea
                    value={formData.specialConditions}
                    onChange={(e) => updateForm("specialConditions", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Suspensive Conditions */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 4: Suspensive Conditions & Deadlines
                </h3>
                <p className="text-xs text-muted-foreground">
                  Set critical deadlines for Bond Approval and FICA clearance. Automated alerts will
                  track these.
                </p>
              </div>

              {/* Bond Approval */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display text-sm font-semibold">
                    <Landmark className="size-4 text-primary" /> Bond Approval Condition
                  </div>
                  <Switch
                    checked={formData.bondRequired}
                    onCheckedChange={(value) => updateForm("bondRequired", value)}
                  />
                </div>

                {formData.bondRequired && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Bond Amount Required (ZAR)</Label>
                      <Input
                        type="number"
                        value={formData.bondAmount}
                        onChange={(e) => updateForm("bondAmount", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bond Approval Due Date (Deadline)</Label>
                      <Input
                        type="date"
                        value={formData.bondDueDate}
                        onChange={(e) => updateForm("bondDueDate", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* FICA Condition */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display text-sm font-semibold">
                    <ShieldCheck className="size-4 text-primary" /> FICA Clearance
                  </div>
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    Required by Law
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>FICA clearance deadline</Label>
                    <Input
                      type="date"
                      value={formData.ficaDueDate}
                      onChange={(e) => updateForm("ficaDueDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Subject to Sale Condition */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display text-sm font-semibold">
                    <Home className="size-4 text-primary" /> Subject to Sale of Existing Property
                  </div>
                  <Switch
                    checked={formData.subjectToSale}
                    onCheckedChange={(v) => updateForm("subjectToSale", v)}
                  />
                </div>
                {formData.subjectToSale && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Description of Property</Label>
                      <Input
                        placeholder="e.g. 10 Main Road, Cape Town"
                        value={formData.subjectToSaleDesc}
                        onChange={(e) => updateForm("subjectToSaleDesc", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Condition Due Date</Label>
                      <Input
                        type="date"
                        value={formData.subjectToSaleDueDate}
                        onChange={(e) => updateForm("subjectToSaleDueDate", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Document Uploads */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 5: Baseline Document Uploads
                </h3>
                <p className="text-xs text-muted-foreground">
                  Upload signed instruments now and initialise the remaining conveyancer checklist.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.propertyDisclosureCompleted}
                    onCheckedChange={(value) => updateForm("propertyDisclosureCompleted", value)}
                  />
                  <Label>
                    Seller completed and signed the statutory PPRA property condition disclosure *
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label>Disclosed defects / additional explanation</Label>
                  <Textarea
                    value={formData.disclosureDefects}
                    onChange={(e) => updateForm("disclosureDefects", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileText className="size-4 text-primary" /> Signed Mandate Document
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required to start the deal process.
                  </p>
                  <FilePicker
                    category="mandate"
                    files={baselineFiles}
                    setFiles={setBaselineFiles}
                  />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileText className="size-4 text-primary" /> Signed Offer to Purchase (OTP)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required to advance past Offer Received.
                  </p>
                  <FilePicker category="otp" files={baselineFiles} setFiles={setBaselineFiles} />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileText className="size-4 text-primary" /> PPRA Property Condition Disclosure
                    *
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be obtained before mandate and attached to the sale agreement.
                  </p>
                  <FilePicker
                    category="property_disclosure"
                    files={baselineFiles}
                    setFiles={setBaselineFiles}
                  />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="size-4 text-primary" /> Seller FICA Documents
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Identity, address, authority, tax and risk-based verification evidence.
                  </p>
                  <FilePicker
                    category="seller_fica"
                    files={baselineFiles}
                    setFiles={setBaselineFiles}
                  />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="size-4 text-primary" /> Purchaser FICA Documents
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Including source-of-funds support appropriate to the risk assessment.
                  </p>
                  <FilePicker
                    category="purchaser_fica"
                    files={baselineFiles}
                    setFiles={setBaselineFiles}
                  />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <Home className="size-4 text-primary" /> Current Title Deed Copy
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required for conveyancer instructions.
                  </p>
                  <FilePicker
                    category="title_deed"
                    files={baselineFiles}
                    setFiles={setBaselineFiles}
                  />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <Home className="size-4 text-primary" /> Latest Municipal Account
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required for rates and clearance instruction.
                  </p>
                  <FilePicker
                    category="municipal_account"
                    files={baselineFiles}
                    setFiles={setBaselineFiles}
                  />
                </div>
                {[...formData.sellers, ...formData.purchasers].some(
                  (party) => party.entityType !== "Natural Person",
                ) && (
                  <div className="rounded-lg border border-border p-4 space-y-2 sm:col-span-2 bg-card">
                    <div className="flex items-center gap-2 font-semibold">
                      <FileText className="size-4 text-primary" /> Entity Registration / Resolution
                      Documents
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Required since parties include non-natural entities.
                    </p>
                    <p className="text-xs text-warning">
                      Add entity resolutions from the deal Documents tab after creation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 6: Review Deal Summary & Checklist
                </h3>
                <p className="text-xs text-muted-foreground">
                  Verify every captured detail below before saving into the pipeline.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ReviewSection title="Property">
                  <p className="text-sm font-semibold">{formData.address || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[formData.suburb, formData.city, formData.province, formData.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <div className="space-y-1 border-t border-border/50 pt-2">
                    <ReviewRow label="Type" value={formData.propertyType} />
                    <ReviewRow label="Use" value={formData.propertyUse} />
                    <ReviewRow
                      label="Size"
                      value={`${formData.beds} bed · ${formData.baths} bath · ${formData.garages} garage`}
                    />
                    <ReviewRow
                      label="Floor / erf size"
                      value={`${formData.floorSize} m² / ${formData.erfSize} m²`}
                    />
                    <ReviewRow label="Erf number" value={formData.erfNumber} />
                    <ReviewRow label="Title deed" value={formData.titleDeedNumber} />
                    <ReviewRow label="Deeds office" value={formData.deedsOffice} />
                  </div>
                  {formData.legalDescription && (
                    <p className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      {formData.legalDescription}
                    </p>
                  )}
                </ReviewSection>

                <ReviewSection title="Mandate & Pricing">
                  <ReviewRow
                    label="Listing price"
                    value={zar(parseFloat(formData.listingPrice) || 0, { decimals: false })}
                  />
                  <ReviewRow
                    label="Sale price"
                    value={
                      <span className="text-primary">
                        {zar(parseFloat(formData.salePrice) || 0, { decimals: false })}
                      </span>
                    }
                  />
                  <ReviewRow
                    label="Commission"
                    value={`${(Number(formData.commissionBps) / 100).toFixed(2)}%`}
                  />
                  <ReviewRow label="Mandate type" value={formData.mandateType} />
                  <ReviewRow
                    label="Mandate signed"
                    value={formData.mandateSigned ? dateFmt(formData.mandateSigned) : undefined}
                  />
                  <ReviewRow
                    label="Mandate expiry"
                    value={formData.mandateExpiry ? dateFmt(formData.mandateExpiry) : undefined}
                  />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/50 pt-2">
                    <ReviewFlag label="VAT sale" on={formData.isVatSale} />
                    {formData.isVatSale && (
                      <ReviewFlag label="VAT inclusive" on={formData.vatInclusive} />
                    )}
                    <ReviewFlag label="Parties connected" on={formData.partiesConnected} />
                    <ReviewFlag label="Seller non-resident" on={formData.sellerIsNonResident} />
                  </div>
                </ReviewSection>

                <ReviewSection title={`Seller(s) — ${formData.sellers.length}`}>
                  <div className="space-y-2">
                    {formData.sellers.map((party, i) => (
                      <ReviewPartyCard key={party._key} party={party} index={i} purchaser={false} />
                    ))}
                  </div>
                </ReviewSection>

                <ReviewSection title={`Purchaser(s) — ${formData.purchasers.length}`}>
                  <div className="space-y-2">
                    {formData.purchasers.map((party, i) => (
                      <ReviewPartyCard key={party._key} party={party} index={i} purchaser={true} />
                    ))}
                  </div>
                </ReviewSection>

                <ReviewSection title="Agreement & Occupation Terms" span>
                  <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    <div className="space-y-1">
                      <ReviewRow
                        label="Effective date"
                        value={formData.effectiveDate ? dateFmt(formData.effectiveDate) : undefined}
                      />
                      <ReviewRow
                        label="Offer expires"
                        value={
                          formData.offerExpiresOn ? dateFmt(formData.offerExpiresOn) : undefined
                        }
                      />
                      <ReviewRow
                        label="Transfer share"
                        value={`${formData.transferSharePercent}%`}
                      />
                      <ReviewRow label="Sale method" value={formData.saleMethod} />
                    </div>
                    <div className="space-y-1">
                      <ReviewRow
                        label="Deposit"
                        value={zar(Number(formData.depositAmount) || 0, { decimals: false })}
                      />
                      <ReviewRow
                        label="Deposit due"
                        value={formData.depositDueOn ? dateFmt(formData.depositDueOn) : undefined}
                      />
                      <ReviewRow label="Deposit holder" value={formData.depositHolder} />
                      <ReviewRow label="Balance payment" value={formData.balancePaymentMethod} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 border-t border-border/50 pt-2 sm:grid-cols-2">
                    <ReviewRow
                      label="Occupation date"
                      value={formData.occupationDate ? dateFmt(formData.occupationDate) : undefined}
                    />
                    <ReviewRow
                      label="Occupational rent"
                      value={
                        formData.occupationalRent
                          ? zar(Number(formData.occupationalRent) || 0, { decimals: false })
                          : undefined
                      }
                    />
                  </div>
                </ReviewSection>

                <ReviewSection title="Suspensive Conditions" span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1 rounded-md border border-border/70 bg-card/50 p-2.5">
                      <ReviewFlag label="Bond required" on={formData.bondRequired} />
                      {formData.bondRequired && (
                        <>
                          <ReviewRow
                            label="Amount"
                            value={zar(Number(formData.bondAmount) || 0, { decimals: false })}
                          />
                          <ReviewRow
                            label="Due"
                            value={formData.bondDueDate ? dateFmt(formData.bondDueDate) : undefined}
                          />
                        </>
                      )}
                    </div>
                    <div className="space-y-1 rounded-md border border-border/70 bg-card/50 p-2.5">
                      <ReviewFlag label="FICA clearance" on={true} />
                      <ReviewRow
                        label="Due"
                        value={formData.ficaDueDate ? dateFmt(formData.ficaDueDate) : undefined}
                      />
                    </div>
                    <div className="space-y-1 rounded-md border border-border/70 bg-card/50 p-2.5">
                      <ReviewFlag label="Subject to sale" on={formData.subjectToSale} />
                      {formData.subjectToSale && (
                        <>
                          <ReviewRow label="Property" value={formData.subjectToSaleDesc} />
                          <ReviewRow
                            label="Due"
                            value={
                              formData.subjectToSaleDueDate
                                ? dateFmt(formData.subjectToSaleDueDate)
                                : undefined
                            }
                          />
                        </>
                      )}
                    </div>
                  </div>
                </ReviewSection>

                <ReviewSection title="Fixtures, Special Conditions & Disclosure" span>
                  <ReviewFlag
                    label="PPRA property condition disclosure completed"
                    on={formData.propertyDisclosureCompleted}
                  />
                  {formData.disclosureDefects && (
                    <p className="text-xs text-muted-foreground">
                      Disclosed defects: {formData.disclosureDefects}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1 border-t border-border/50 pt-2 sm:grid-cols-2">
                    <ReviewRow label="Fixtures included" value={formData.fixturesIncluded} />
                    <ReviewRow label="Fixtures excluded" value={formData.fixturesExcluded} />
                  </div>
                  {formData.specialConditions && (
                    <p className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      {formData.specialConditions}
                    </p>
                  )}
                </ReviewSection>

                <ReviewSection title="Conveyancer, Agent & Documents" span>
                  <ReviewRow label="Conveyancer" value={formData.conveyancer} />
                  <ReviewRow label="Reference" value={formData.conveyancerReference} />
                  <ReviewRow
                    label="Lead agent"
                    value={users.find((u) => u.id === formData.agentId)?.name || "Current user"}
                  />
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/50 pt-2">
                    {Object.entries(DOCUMENT_LABELS).map(([category, label]) => (
                      <ReviewFlag key={category} label={label} on={!!baselineFiles[category]} />
                    ))}
                  </div>
                </ReviewSection>
              </div>
            </div>
          )}

          {/* Stepper Navigation Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" onClick={handleBack} disabled={step === 1}>
              <ArrowLeft className="mr-1 size-4" /> Previous
            </Button>

            {step < STEPS.length ? (
              <Button onClick={handleNext}>
                Next <ArrowRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Create Deal & Initialize Pipeline
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
