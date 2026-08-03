import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDeal } from "@/data/deals";
import { users } from "@/data/mock";
import {
  Home,
  User,
  ShieldCheck,
  FileCheck,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Upload,
} from "lucide-react";

export const Route = createFileRoute("/mandates/new")({
  head: () => ({
    meta: [
      { title: "Register Property Mandate | Dream Supreme Properties" },
      {
        name: "description",
        content: "Register a new EAAB & FICA compliant property listing mandate.",
      },
    ],
  }),
  component: NewMandatePage,
});

const STEPS = [
  { id: 1, name: "Property Details", icon: Home },
  { id: 2, name: "Mandate & Terms", icon: FileCheck },
  { id: 3, name: "Seller & FICA", icon: ShieldCheck },
  { id: 4, name: "Document Uploads", icon: Upload },
  { id: 5, name: "Review & Register", icon: CheckCircle2 },
];

function NewMandatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    // Property Info
    address: "",
    suburb: "",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    propertyType: "Freehold House",
    beds: "3",
    baths: "2",
    garages: "2",
    floorSize: "180",
    erfSize: "500",
    deedsDescription: "",
    titleDeedNumber: "",

    // Mandate Terms
    mandateType: "Sole",
    listingPrice: "2500000",
    agreedCommissionPct: "5.0",
    mandateStartDate: new Date().toISOString().split("T")[0],
    mandateExpiryDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    agentId: users[0]?.id || "",

    // Seller Info & FICA
    sellerName: "",
    sellerEmail: "",
    sellerMobile: "",
    sellerIdNumber: "",
    sellerAddress: "",
    sellerFica: "Complete",
    popiaConsent: true,

    // Document attachments
    mandateDoc: null as File | null,
    sellerIdDoc: null as File | null,
    titleDeedDoc: null as File | null,
  });

  const update = (key: string, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleNext = () => {
    if (step === 1 && !form.address) {
      toast.error("Please enter the property street address.");
      return;
    }
    if (step === 2 && (!form.listingPrice || !form.mandateExpiryDate)) {
      toast.error("Please enter the asking price and mandate expiry date.");
      return;
    }
    if (step === 3 && !form.sellerName) {
      toast.error("Please enter the seller / mandator full name.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      toast.loading("Registering property mandate...", { id: "new-mandate" });

      const commissionBps = (parseFloat(form.agreedCommissionPct || "5") * 100).toString();

      await createDeal({
        ...form,
        commissionBps,
        buyerName: "Unassigned Purchaser",
        salePrice: form.listingPrice,
        otpSigned: form.mandateStartDate,
        occupationDate: form.mandateExpiryDate,
        conveyancer: "Vogel & Associates Attorneys",
        bondRequired: false,
        bondAmount: "0",
        bondDueDate: form.mandateExpiryDate,
        ficaRequired: true,
        ficaDueDate: form.mandateStartDate,
      });

      toast.success("Mandate registered successfully!", { id: "new-mandate" });
      navigate({ to: "/mandates" });
    } catch (err: any) {
      toast.error(`Failed to register mandate: ${err.message}`, { id: "new-mandate" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      title="Register Property Mandate"
      description="Create an EAAB & FICA compliant listing mandate with full legal attributes."
      actions={
        <Button variant="outline" asChild>
          <Link to="/mandates">
            <ArrowLeft className="mr-2 size-4" /> Back to Mandates
          </Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Step Stepper Header */}
        <div className="grid grid-cols-5 gap-2 border-b border-border pb-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = s.id < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => done && setStep(s.id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-center transition-all ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow"
                    : done
                      ? "bg-muted text-foreground cursor-pointer hover:bg-accent"
                      : "text-muted-foreground opacity-50 cursor-not-allowed"
                }`}
              >
                <Icon className="size-4" />
                <span className="text-xs">{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Wizard Form Sections */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {/* Step 1: Property Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold">Step 1: Property & Location</h3>
                <p className="text-xs text-muted-foreground">
                  Specify the physical property location and deeds details.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Street Address *</Label>
                  <Input
                    placeholder="e.g. 42 Sandton Drive"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Suburb *</Label>
                  <Input
                    placeholder="e.g. Morningside"
                    value={form.suburb}
                    onChange={(e) => update("suburb", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">City</Label>
                  <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Province</Label>
                  <Input
                    value={form.province}
                    onChange={(e) => update("province", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Postal Code</Label>
                  <Input
                    value={form.postalCode}
                    onChange={(e) => update("postalCode", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Property Category</Label>
                  <Select
                    value={form.propertyType}
                    onValueChange={(v) => update("propertyType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Freehold House">Freehold House</SelectItem>
                      <SelectItem value="Sectional Title Apartment">
                        Sectional Title Apartment
                      </SelectItem>
                      <SelectItem value="Estate Villa">Estate Villa</SelectItem>
                      <SelectItem value="Townhouse">Townhouse</SelectItem>
                      <SelectItem value="Vacant Land">Vacant Land</SelectItem>
                      <SelectItem value="Commercial">Commercial Property</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Bedrooms</Label>
                  <Input
                    type="number"
                    value={form.beds}
                    onChange={(e) => update("beds", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Mandate & Terms */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 2: Mandate Agreement Terms
                </h3>
                <p className="text-xs text-muted-foreground">
                  Define mandate classification, asking price, and expiry parameters.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mandate Type *</Label>
                  <Select value={form.mandateType} onValueChange={(v) => update("mandateType", v)}>
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

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Asking Listing Price (ZAR) *</Label>
                  <Input
                    type="number"
                    value={form.listingPrice}
                    onChange={(e) => update("listingPrice", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Agreed Commission (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.agreedCommissionPct}
                    onChange={(e) => update("agreedCommissionPct", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Listing Agent</Label>
                  <Select value={form.agentId} onValueChange={(v) => update("agentId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mandate Effective Date</Label>
                  <Input
                    type="date"
                    value={form.mandateStartDate}
                    onChange={(e) => update("mandateStartDate", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mandate Expiry Date *</Label>
                  <Input
                    type="date"
                    value={form.mandateExpiryDate}
                    onChange={(e) => update("mandateExpiryDate", e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Seller & FICA */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 3: Seller (Mandator) & FICA
                </h3>
                <p className="text-xs text-muted-foreground">
                  Record identity and FICA verification data for property owners.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Seller Full Name *</Label>
                  <Input
                    placeholder="e.g. John Smith"
                    value={form.sellerName}
                    onChange={(e) => update("sellerName", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">SA ID / Passport Number</Label>
                  <Input
                    placeholder="e.g. 8501015029087"
                    value={form.sellerIdNumber}
                    onChange={(e) => update("sellerIdNumber", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={form.sellerEmail}
                    onChange={(e) => update("sellerEmail", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mobile Phone</Label>
                  <Input
                    placeholder="+27 82 123 4567"
                    value={form.sellerMobile}
                    onChange={(e) => update("sellerMobile", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 4: Mandate Document Uploads
                </h3>
                <p className="text-xs text-muted-foreground">
                  Attach signed mandate contracts and FICA identification documents.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <FileCheck className="size-4 text-primary" /> Signed Mandate Document
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Signed Sole or Joint Mandate Agreement.
                  </p>
                  <label className="flex w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="mr-2 size-4" />
                    <span className="truncate">
                      {form.mandateDoc?.name || "Choose Mandate PDF"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={(e) => update("mandateDoc", e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="size-4 text-primary" /> Seller FICA Identity Document
                  </div>
                  <p className="text-xs text-muted-foreground">Copy of SA ID or Passport.</p>
                  <label className="flex w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="mr-2 size-4" />
                    <span className="truncate">
                      {form.sellerIdDoc?.name || "Choose ID Document"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={(e) => update("sellerIdDoc", e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Create */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold">Step 5: Review & Confirm</h3>
                <p className="text-xs text-muted-foreground">
                  Verify mandate parameters before adding to the mandate register.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 bg-muted/30">
                <div>
                  <span className="text-xs text-muted-foreground">Property Address</span>
                  <p className="text-sm font-semibold">{form.address || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.suburb}, {form.city}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Mandate Type & Price</span>
                  <p className="text-sm font-semibold text-primary">R {form.listingPrice}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.mandateType} Mandate ({form.agreedCommissionPct}% Comm.)
                  </p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Seller (Mandator)</span>
                  <p className="text-sm font-semibold">{form.sellerName || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">{form.sellerEmail || "No email"}</p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Expiry Date</span>
                  <p className="text-sm font-semibold">{form.mandateExpiryDate}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handlePrev} disabled={step === 1}>
              <ArrowLeft className="mr-2 size-4" /> Previous
            </Button>

            {step < STEPS.length ? (
              <Button type="button" onClick={handleNext}>
                Next <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {loading ? "Registering..." : "Confirm & Register Mandate"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
