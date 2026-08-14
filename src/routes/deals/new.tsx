import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { zar } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import type { EntityType } from "@/types";

export const Route = createFileRoute("/deals/new")({
  validateSearch: (search: Record<string, unknown>): { mandateId?: string } => ({
    mandateId: search.mandateId as string | undefined,
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
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={party.isVatVendor}
              onCheckedChange={(value) => onChange("isVatVendor", value)}
            />
            <Label>VAT vendor</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={party.popiaConsent}
              onCheckedChange={(value) => onChange("popiaConsent", value)}
            />
            <Label>POPIA processing notice acknowledged</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={party.sanctionsScreened}
              onCheckedChange={(value) => onChange("sanctionsScreened", value)}
            />
            <Label>TFS / sanctions screening completed *</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={party.isProminentPerson}
              onCheckedChange={(value) => onChange("isProminentPerson", value)}
            />
            <Label>Domestic/foreign prominent person</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewDealPage() {
  const { account } = useAuth();
  const navigate = useNavigate();
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

  const [formData, setFormData] = useState<DealCaptureForm>(createInitialDealCapture);

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
              <div
                key={s.id}
                onClick={() => isDone && setStep(s.id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors ${
                  isDone ? "cursor-pointer hover:bg-muted" : ""
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
              </div>
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
                  <Label>Full deeds-search property description *</Label>
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
                    key={`seller-${index}`}
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
                    key={`purchaser-${index}`}
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
                  Verify deal attributes before saving into pipeline.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Property</span>
                  <p className="text-sm font-semibold">{formData.address || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formData.suburb}, {formData.city}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Sale & Mandate Price</span>
                  <p className="text-sm font-semibold text-primary">
                    {zar(parseFloat(formData.salePrice) || 0, { decimals: false })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Listing: {zar(parseFloat(formData.listingPrice) || 0, { decimals: false })} (
                    {formData.mandateType})
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Seller(s)</span>
                  <p className="text-sm font-semibold">
                    {formData.sellers.map((party) => party.name).join(", ") || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formData.sellers.length} transferor record(s)
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Purchaser(s)</span>
                  <p className="text-sm font-semibold">
                    {formData.purchasers.map((party) => party.name).join(", ") || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formData.purchasers.length} transferee record(s)
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Agreement terms</span>
                  <p className="text-sm font-semibold">
                    Effective {formData.effectiveDate} · {formData.transferSharePercent}% share
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deposit {zar(Number(formData.depositAmount) || 0, { decimals: false })}; bond{" "}
                    {formData.bondRequired
                      ? zar(Number(formData.bondAmount) || 0, { decimals: false })
                      : "not required"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Conveyancer & Lead Agent</span>
                  <p className="text-sm font-semibold">{formData.conveyancer}</p>
                  <p className="text-xs text-muted-foreground">
                    Agent: {users.find((u) => u.id === formData.agentId)?.name || "Current user"}
                  </p>
                </div>
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
