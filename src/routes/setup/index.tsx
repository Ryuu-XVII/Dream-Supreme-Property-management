import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Receipt,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/setup/")({
  head: () => ({
    meta: [
      { title: "Agency Onboarding Setup | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Guided setup wizard to configure agency profile, branches, team practitioners, and default commission rules.",
      },
    ],
  }),
  component: SetupPage,
});

const STEPS = [
  { id: 1, title: "Agency Details", desc: "PPRA & VAT registration", icon: Building2 },
  { id: 2, title: "Branches & Team", desc: "Offices & practitioner FFCs", icon: Users },
  { id: 3, title: "Commission Model", desc: "Default split & deductions", icon: Receipt },
  { id: 4, title: "Review & Launch", desc: "Confirm setup", icon: ShieldCheck },
];

function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    agencyName: "Dream Supreme Properties (Pty) Ltd",
    regNumber: "2019/123456/07",
    ppraRef: "F114820",
    isVatVendor: true,
    vatNumber: "4980112233",
    mainBranch: "Sandton Main",

    secondaryBranch: "Fourways Office",
    hasSecondaryBranch: true,

    adminName: "Thandiwe Mokoena",
    adminEmail: "thandiwe@dreamsupreme.co.za",

    defaultCommissionPct: "5.0",
    franchiseFeePct: "6.0",
    officeSharePct: "50",

    initialImportChoice: "manual", // 'manual' | 'csv'
  });

  const update = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleNext = () => {
    if (step === 1 && !form.agencyName) {
      toast.error("Please enter the agency name.");
      return;
    }
    if (step < STEPS.length) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = () => {
    toast.success("Agency setup saved successfully! Welcome to Mandate.");
    if (form.initialImportChoice === "csv") {
      navigate({ to: "/setup/import" });
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-1">
              FR-ON-03 Guided Onboarding
            </Badge>
            <h1 className="font-display text-2xl font-bold tracking-tight">Agency Setup Wizard</h1>
            <p className="text-sm text-muted-foreground">
              Configure your estate agency operations platform in under 30 minutes.
            </p>
          </div>
          <Link to="/setup/import">
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="mr-1.5 size-4 text-emerald-500" /> Import Existing CSV
              Data
            </Button>
          </Link>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-border bg-card/60 p-3 backdrop-blur-md">
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
                  className={`text-xs font-medium ${isActive ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        <GlassCard>
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 1: Agency Regulatory Details
                </h3>
                <p className="text-xs text-muted-foreground">
                  Provide official entity registration and PPRA details.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Registered Agency Name *</Label>
                  <Input
                    value={form.agencyName}
                    onChange={(e) => update("agencyName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CIPC Registration Number</Label>
                  <Input
                    value={form.regNumber}
                    onChange={(e) => update("regNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>PPRA Firm Reference Number *</Label>
                  <Input value={form.ppraRef} onChange={(e) => update("ppraRef", e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
                  <div>
                    <Label className="mb-0.5 block">VAT Registered Vendor</Label>
                    <p className="text-xs text-muted-foreground">
                      Is the agency registered for VAT with SARS?
                    </p>
                  </div>
                  <Switch
                    checked={form.isVatVendor}
                    onCheckedChange={(v) => update("isVatVendor", v)}
                  />
                </div>
                {form.isVatVendor && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>SARS VAT Registration Number</Label>
                    <Input
                      value={form.vatNumber}
                      onChange={(e) => update("vatNumber", e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 2: Branches & Primary Contact
                </h3>
                <p className="text-xs text-muted-foreground">
                  Set up office locations and principal administrator credentials.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Primary Branch / Head Office *</Label>
                  <Input
                    value={form.mainBranch}
                    onChange={(e) => update("mainBranch", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Secondary Branch (Optional)</Label>
                  <Input
                    value={form.secondaryBranch}
                    onChange={(e) => update("secondaryBranch", e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 border-t border-border pt-4">
                  <h4 className="mb-2 font-display text-sm font-semibold">
                    Principal / Managing Practitioner
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <Label>Principal Full Name *</Label>
                  <Input
                    value={form.adminName}
                    onChange={(e) => update("adminName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Principal Email Address *</Label>
                  <Input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => update("adminEmail", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 3: Default Commission Rules
                </h3>
                <p className="text-xs text-muted-foreground">
                  Set up default commission rates and office split percentages.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default Sales Commission Rate (%)</Label>
                  <Input
                    value={form.defaultCommissionPct}
                    onChange={(e) => update("defaultCommissionPct", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Franchise Royalty Fee (%)</Label>
                  <Input
                    value={form.franchiseFeePct}
                    onChange={(e) => update("franchiseFeePct", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Default Office Share vs Agent Pool (%)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={form.officeSharePct}
                      onChange={(e) => update("officeSharePct", e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">
                      Office: {form.officeSharePct}% / Agent Pool:{" "}
                      {100 - Number(form.officeSharePct || 0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Step 4: Launch & Historical Data Import
                </h3>
                <p className="text-xs text-muted-foreground">
                  Choose how to bring your existing pipeline into Mandate.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div
                  onClick={() => update("initialImportChoice", "manual")}
                  className={`lift cursor-pointer rounded-xl border p-4 transition-colors ${
                    form.initialImportChoice === "manual"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-sm font-semibold">
                      Start Fresh / Manual Capture
                    </span>
                    {form.initialImportChoice === "manual" && (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Start with a clean database and add new deals as they arrive.
                  </p>
                </div>

                <div
                  onClick={() => update("initialImportChoice", "csv")}
                  className={`lift cursor-pointer rounded-xl border p-4 transition-colors ${
                    form.initialImportChoice === "csv"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-sm font-semibold">
                      Import CSV Spreadsheet
                    </span>
                    {form.initialImportChoice === "csv" && (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload your active Excel/CSV pipeline to bulk-import practitioners, properties &
                    deals.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Footer */}
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
                onClick={handleFinish}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Complete Setup
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
