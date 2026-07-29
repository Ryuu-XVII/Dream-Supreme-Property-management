import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { STAGES, users, conveyancerFirms, deals, type Deal, type Property, type Party, type Condition, type DocumentRec, type Offer } from "@/data/mock";
import { zar } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Home, User, FileText, Landmark, ShieldCheck,
} from "lucide-react";
import { createDeal } from "@/data/deals";

export const Route = createFileRoute("/deals/new")({
  head: () => ({
    meta: [
      { title: "New Deal Wizard | Dream Supreme Properties" },
      { name: "description", content: "Create a new property sales deal and capture initial suspensive conditions." },
    ],
  }),
  component: NewDealPage,
});

const STEPS = [
  { id: 1, name: "Property & Mandate", icon: Home },
  { id: 2, name: "Parties (Seller & Buyer)", icon: User },
  { id: 3, name: "OTP & Conveyancer", icon: FileText },
  { id: 4, name: "Suspensive Conditions", icon: Landmark },
  { id: 5, name: "Review & Create", icon: ShieldCheck },
];

function NewDealPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    // Property
    address: "",
    suburb: "",
    city: "Johannesburg",
    propertyType: "Freehold House" as Property["type"],
    beds: 3,
    baths: 2,
    garages: 2,
    floorSize: 180,
    erfSize: 500,

    // Mandate
    mandateType: "Sole" as Deal["mandateType"],
    listingPrice: "2500000",
    commissionBps: "500",
    mandateSigned: new Date().toISOString().split("T")[0],
    mandateExpiry: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],

    // Parties
    sellerName: "",
    sellerEmail: "",
    sellerMobile: "",
    sellerFica: "Complete" as Party["fica"],

    buyerName: "",
    buyerEmail: "",
    buyerMobile: "",
    buyerFica: "Partial" as Party["fica"],

    // Financials & Conveyancer
    salePrice: "2450000",
    otpSigned: new Date().toISOString().split("T")[0],
    occupationDate: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
    conveyancer: conveyancerFirms[0]?.name || "Vogel & Associates Attorneys",
    agentId: users[0]?.id || "u1",

    // Conditions
    bondRequired: true,
    bondAmount: "2000000",
    bondDueDate: new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0],
    
    ficaRequired: true,
    ficaDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  });

  const updateForm = (key: string, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleNext = () => {
    if (step === 1 && (!formData.address || !formData.listingPrice)) {
      toast.error("Please fill in property address and listing price");
      return;
    }
    if (step === 2 && (!formData.sellerName || !formData.buyerName)) {
      toast.error("Please fill in seller and buyer names");
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
      toast.loading("Creating deal...", { id: "create-deal" });
      const dealId = await createDeal(formData);
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
            <Link to="/pipeline" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Back to Pipeline
            </Link>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Create New Deal</h1>
            <p className="text-sm text-muted-foreground">
              Capture property, mandate, transaction parties, and suspensive condition deadlines.
            </p>
          </div>
        </div>

        {/* Stepper Header */}
        <div className="grid grid-cols-5 gap-2 rounded-xl border border-border bg-card/60 p-3 backdrop-blur-md">
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
                <h3 className="font-display text-lg font-semibold">Step 1: Property & Mandate Details</h3>
                <p className="text-xs text-muted-foreground">Enter property address and mandate specifics.</p>
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
                  <Label>City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => updateForm("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Property Type</Label>
                  <Select value={formData.propertyType} onValueChange={(v) => updateForm("propertyType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Freehold House">Freehold House</SelectItem>
                      <SelectItem value="Sectional Title">Sectional Title</SelectItem>
                      <SelectItem value="Estate House">Estate House</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Beds</Label>
                    <Input type="number" value={formData.beds} onChange={(e) => updateForm("beds", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Baths</Label>
                    <Input type="number" value={formData.baths} onChange={(e) => updateForm("baths", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Garages</Label>
                    <Input type="number" value={formData.garages} onChange={(e) => updateForm("garages", +e.target.value)} />
                  </div>
                </div>

                <div className="sm:col-span-2 border-t border-border pt-4">
                  <h4 className="mb-3 font-display text-sm font-semibold">Mandate Setup</h4>
                </div>

                <div className="space-y-1.5">
                  <Label>Mandate Type</Label>
                  <Select value={formData.mandateType} onValueChange={(v) => updateForm("mandateType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sole">Sole Mandate</SelectItem>
                      <SelectItem value="Joint">Joint Mandate</SelectItem>
                      <SelectItem value="Open">Open Mandate</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Select value={formData.commissionBps} onValueChange={(v) => updateForm("commissionBps", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                <p className="text-xs text-muted-foreground">Capture Seller and Purchaser contact details and FICA status.</p>
              </div>

              {/* Seller */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <h4 className="font-display text-sm font-semibold text-primary">Seller Information</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Seller Full Name / Entity *</Label>
                    <Input
                      placeholder="e.g. Johan & Susan Coetzee"
                      value={formData.sellerName}
                      onChange={(e) => updateForm("sellerName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Seller Email</Label>
                    <Input
                      type="email"
                      placeholder="johan@example.co.za"
                      value={formData.sellerEmail}
                      onChange={(e) => updateForm("sellerEmail", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Seller Mobile</Label>
                    <Input
                      placeholder="082 123 4567"
                      value={formData.sellerMobile}
                      onChange={(e) => updateForm("sellerMobile", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Seller FICA Status</Label>
                    <Select value={formData.sellerFica} onValueChange={(v) => updateForm("sellerFica", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Complete">Complete (Verified)</SelectItem>
                        <SelectItem value="Partial">Pending Documents</SelectItem>
                        <SelectItem value="Not Started">Not Started</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Purchaser */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <h4 className="font-display text-sm font-semibold text-primary">Purchaser Information</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Purchaser Full Name / Entity *</Label>
                    <Input
                      placeholder="e.g. Dr. Sipho Khumalo"
                      value={formData.buyerName}
                      onChange={(e) => updateForm("buyerName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Purchaser Email</Label>
                    <Input
                      type="email"
                      placeholder="sipho@example.co.za"
                      value={formData.buyerEmail}
                      onChange={(e) => updateForm("buyerEmail", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Purchaser Mobile</Label>
                    <Input
                      placeholder="083 987 6543"
                      value={formData.buyerMobile}
                      onChange={(e) => updateForm("buyerMobile", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Purchaser FICA Status</Label>
                    <Select value={formData.buyerFica} onValueChange={(v) => updateForm("buyerFica", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Complete">Complete (Verified)</SelectItem>
                        <SelectItem value="Partial">Pending Documents</SelectItem>
                        <SelectItem value="Not Started">Not Started</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: OTP & Conveyancer */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">Step 3: OTP & Financial Summary</h3>
                <p className="text-xs text-muted-foreground">Capture agreed sale price and appointed conveyancer attorney.</p>
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
                <div className="space-y-1.5">
                  <Label>OTP Signed Date</Label>
                  <Input
                    type="date"
                    value={formData.otpSigned}
                    onChange={(e) => updateForm("otpSigned", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estimated Occupation Date</Label>
                  <Input
                    type="date"
                    value={formData.occupationDate}
                    onChange={(e) => updateForm("occupationDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Appointed Conveyancer Firm</Label>
                  <Select value={formData.conveyancer} onValueChange={(v) => updateForm("conveyancer", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {conveyancerFirms.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Lead Listing Practitioner</Label>
                  <Select value={formData.agentId} onValueChange={(v) => updateForm("agentId", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.role} — {u.branch})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Suspensive Conditions */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">Step 4: Suspensive Conditions & Deadlines</h3>
                <p className="text-xs text-muted-foreground">
                  Set critical deadlines for Bond Approval and FICA clearance. Automated alerts will track these.
                </p>
              </div>

              {/* Bond Approval */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display text-sm font-semibold">
                    <Landmark className="size-4 text-primary" /> Bond Approval Condition
                  </div>
                </div>

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
              </div>

              {/* Deposit Condition */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display text-sm font-semibold">
                    <ShieldCheck className="size-4 text-primary" /> Deposit Clearance
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Deposit Due Deadline</Label>
                    <Input
                      type="date"
                      value={formData.ficaDueDate}
                      onChange={(e) => updateForm("ficaDueDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">Step 5: Review Deal Summary</h3>
                <p className="text-xs text-muted-foreground">Verify deal attributes before saving into pipeline.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Property</span>
                  <p className="text-sm font-semibold">{formData.address || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">{formData.suburb}, {formData.city}</p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Sale & Mandate Price</span>
                  <p className="text-sm font-semibold text-primary">{zar(parseFloat(formData.salePrice) || 0, { decimals: false })}</p>
                  <p className="text-xs text-muted-foreground">Listing: {zar(parseFloat(formData.listingPrice) || 0, { decimals: false })} ({formData.mandateType})</p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Seller</span>
                  <p className="text-sm font-semibold">{formData.sellerName || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">{formData.sellerEmail || "No email"}</p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1">
                  <span className="text-xs text-muted-foreground">Purchaser</span>
                  <p className="text-sm font-semibold">{formData.buyerName || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">{formData.buyerEmail || "No email"}</p>
                </div>

                <div className="rounded-lg border border-border p-3 space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Conveyancer & Lead Agent</span>
                  <p className="text-sm font-semibold">{formData.conveyancer}</p>
                  <p className="text-xs text-muted-foreground">Agent: {users.find((u) => u.id === formData.agentId)?.name}</p>
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
              <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Create Deal & Initialize Pipeline
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
