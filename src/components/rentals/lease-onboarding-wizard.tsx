import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { dateFmt, zar } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Calendar,
  Wallet,
  ShieldCheck,
  FileText,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useCreateLeaseOnboarding } from "@/data/rentals";
import { useGeneratePdfDocument } from "@/data/pdf-generate";

interface LeaseOnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaseOnboardingWizard({ open, onOpenChange }: LeaseOnboardingWizardProps) {
  const { account } = useAuth();
  const createLeaseMutation = useCreateLeaseOnboarding();
  const generatePdf = useGeneratePdfDocument();

  const [activeStep, setActiveStep] = useState("step1");

  // Step 1: Property & Parties
  const [propertyId, setPropertyId] = useState("");
  const [landlordPartyId, setLandlordPartyId] = useState("");
  const [tenantPartyId, setTenantPartyId] = useState("");
  const [occupantsText, setOccupantsText] = useState("");
  const [managedBy, setManagedBy] = useState("");

  // Step 2: Term & Escalations
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [escalationRatePct, setEscalationRatePct] = useState("8.0");
  const [escalationMonth, setEscalationMonth] = useState("1");
  const [cpaNoticeApplicable, setCpaNoticeApplicable] = useState(true);

  // Step 3: Financials & Fees
  const [depositAmount, setDepositAmount] = useState("");
  const [depositHeldBy, setDepositHeldBy] = useState<"agency_trust" | "landlord">("agency_trust");
  const [managementFeePct, setManagementFeePct] = useState("8.0");
  const [procurementFeeRand, setProcurementFeeRand] = useState("");
  const [adminFeeRand, setAdminFeeRand] = useState("1500");
  const [proRataRentRand, setProRataRentRand] = useState("");

  // Step 4: Compliance & Ingoing Inspection
  const [inspectionDate, setInspectionDate] = useState("");
  const [tenantFicaVerified, setTenantFicaVerified] = useState(true);
  const [landlordBankVerified, setLandlordBankVerified] = useState(true);
  const [autoGenerateLeaseDoc, setAutoGenerateLeaseDoc] = useState(true);

  // Agency config query to load default settings
  const agencySettingsQuery = useQuery({
    queryKey: ["agency-settings-wizard", account?.agencyId],
    enabled: !!account && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agency")
        .select(
          "default_management_fee_bps, default_procurement_fee_cents, pro_rata_calculation_basis",
        )
        .eq("id", account!.agencyId)
        .single();
      if (error) return null;
      return data;
    },
  });

  // Load agency defaults into form
  useEffect(() => {
    if (agencySettingsQuery.data) {
      if (agencySettingsQuery.data.default_management_fee_bps !== undefined) {
        setManagementFeePct((agencySettingsQuery.data.default_management_fee_bps / 100).toFixed(1));
      }
      if (agencySettingsQuery.data.default_procurement_fee_cents) {
        setProcurementFeeRand(
          (agencySettingsQuery.data.default_procurement_fee_cents / 100).toString(),
        );
      }
    }
  }, [agencySettingsQuery.data]);

  // Options queries
  const propertiesQuery = useQuery({
    queryKey: ["wizard-properties", account?.agencyId],
    enabled: !!account && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property")
        .select("id, address_line, suburb, city")
        .eq("agency_id", account!.agencyId)
        .order("address_line");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        label: `${p.address_line || "Property #" + p.id.slice(0, 6)} ${p.suburb ? `(${p.suburb})` : ""}`,
      }));
    },
  });

  const partiesQuery = useQuery({
    queryKey: ["wizard-parties", account?.agencyId],
    enabled: !!account && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party")
        .select("id, full_name, party_type, entity_type")
        .eq("agency_id", account!.agencyId)
        .is("archived_at", null)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const agentsQuery = useQuery({
    queryKey: ["wizard-agents", account?.agencyId],
    enabled: !!account && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_account")
        .select("id, full_name")
        .eq("agency_id", account!.agencyId)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) return;
    const queries = [
      { query: propertiesQuery, label: "properties" },
      { query: partiesQuery, label: "landlord/tenant parties" },
      { query: agentsQuery, label: "rental practitioners" },
    ];
    for (const { query, label } of queries) {
      if (query.isError) {
        toast.error(
          `Could not load ${label}: ${query.error instanceof Error ? query.error.message : "unknown error"}`,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, propertiesQuery.isError, partiesQuery.isError, agentsQuery.isError]);

  // Calculate pro-rata rent preview automatically
  useEffect(() => {
    if (!startDate || !rentAmount || isNaN(Number(rentAmount))) return;
    const dateObj = new Date(startDate);
    const day = dateObj.getDate();
    if (day <= 1) {
      setProRataRentRand("0");
      return;
    }

    const rent = parseFloat(rentAmount);
    const basis = agencySettingsQuery.data?.pro_rata_calculation_basis || "exact_calendar_days";
    let proRata = 0;

    if (basis === "exact_calendar_days") {
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();
      const daysRemaining = daysInMonth - day + 1;
      proRata = Math.round((rent / daysInMonth) * daysRemaining);
    } else {
      const daysRemaining = 30 - day + 1;
      proRata = Math.round((rent / 30) * Math.max(0, daysRemaining));
    }

    setProRataRentRand(proRata.toString());
  }, [startDate, rentAmount, agencySettingsQuery.data]);

  const handleSubmitWizard = async () => {
    if (!propertyId || !landlordPartyId || !tenantPartyId) {
      toast.error("Please complete Step 1: Select Property, Landlord, and Tenant.");
      setActiveStep("step1");
      return;
    }
    if (!startDate || !endDate || !rentAmount) {
      toast.error("Please complete Step 2: Set Start Date, End Date, and Base Rent.");
      setActiveStep("step2");
      return;
    }
    if (endDate <= startDate) {
      toast.error("Lease end date must be after the start date.");
      setActiveStep("step2");
      return;
    }

    const rentNum = parseFloat(rentAmount);
    if (!rentNum || rentNum <= 0 || rentNum > 10_000_000) {
      toast.error("Please enter a valid monthly rent amount (up to R10,000,000).");
      setActiveStep("step2");
      return;
    }

    const mgmtPct = parseFloat(managementFeePct) || 0;
    if (mgmtPct < 0 || mgmtPct > 100) {
      toast.error("Management fee percentage must be between 0% and 100%.");
      setActiveStep("step3");
      return;
    }

    const escPct = parseFloat(escalationRatePct) || 0;
    if (escPct < 0 || escPct > 100) {
      toast.error("Escalation rate percentage must be between 0% and 100%.");
      setActiveStep("step2");
      return;
    }

    try {
      const rentCents = Math.round(rentNum * 100);
      const depCents = Math.max(0, Math.round((parseFloat(depositAmount) || 0) * 100));
      const procCents = Math.max(0, Math.round((parseFloat(procurementFeeRand) || 0) * 100));
      const adminCents = Math.max(0, Math.round((parseFloat(adminFeeRand) || 1500) * 100));
      const proRataCents = Math.max(0, Math.round((parseFloat(proRataRentRand) || 0) * 100));
      const mgmtBps = Math.min(10000, Math.max(0, Math.round(mgmtPct * 100)));
      const escBps = Math.min(10000, Math.max(0, Math.round(escPct * 100)));

      const newLeaseId = await createLeaseMutation.mutateAsync({
        propertyId,
        landlordPartyId,
        tenantPartyId,
        managedBy: managedBy || account?.id,
        monthlyRentCents: rentCents,
        depositCents: depCents,
        depositHeldBy,
        procurementFeeCents: procCents,
        managementFeeBps: mgmtBps,
        startOn: startDate,
        endOn: endDate,
        escalationRateBps: escBps,
        escalationMonth: parseInt(escalationMonth, 10) || 1,
        adminFeeCents: adminCents,
        proRataRentCents: proRataCents,
        inspectionDate: inspectionDate || undefined,
        occupantsText: occupantsText.trim(),
        cpaNoticeApplicable,
      });

      if (autoGenerateLeaseDoc) {
        try {
          const propertyLabel = propertiesQuery.data?.find((p) => p.id === propertyId)?.label ?? "";
          const landlordName =
            partiesQuery.data?.find((p) => p.id === landlordPartyId)?.full_name ?? "";
          const tenantName =
            partiesQuery.data?.find((p) => p.id === tenantPartyId)?.full_name ?? "";
          await generatePdf.mutateAsync({
            documentType: "lease_agreement",
            filename: `lease_agreement_${newLeaseId}.pdf`,
            inputs: {
              propertyAddress: propertyLabel,
              landlordName,
              tenantName,
              monthlyRent: zar(rentCents),
              startDate: dateFmt(startDate),
              endDate: dateFmt(endDate),
            },
          });
          toast.success("Lease agreement PDF generated.");
        } catch (docErr) {
          console.error("Document auto-generation notice:", docErr);
          toast.error(
            docErr instanceof Error
              ? `Lease onboarding completed, but the lease agreement PDF could not be generated: ${docErr.message}`
              : "Lease onboarding completed, but the lease agreement PDF could not be generated.",
          );
        }
      }

      toast.success("Lease onboarding completed cleanly!", {
        description: "Inserted lease, trust deposit ledger, and pro-rata invoice.",
      });

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to complete lease onboarding.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Lease Onboarding & Rental Agreement Capture
          </DialogTitle>
          <DialogDescription>
            Multi-step compliance wizard for capturing terms under the Rental Housing Act & PPA.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeStep} onValueChange={setActiveStep} className="mt-2 space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="step1" className="text-xs">
              1. Parties & Asset
            </TabsTrigger>
            <TabsTrigger value="step2" className="text-xs">
              2. Term & Rates
            </TabsTrigger>
            <TabsTrigger value="step3" className="text-xs">
              3. Fees & Trust
            </TabsTrigger>
            <TabsTrigger value="step4" className="text-xs">
              4. Compliance
            </TabsTrigger>
          </TabsList>

          {/* STEP 1: PROPERTY & PARTIES */}
          <TabsContent value="step1" className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <Building2 className="size-4" /> Property & Agent Assignment
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="prop">Property Address *</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger id="prop">
                    <SelectValue placeholder="Select property asset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {propertiesQuery.data?.length ? (
                      propertiesQuery.data.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {propertiesQuery.isLoading
                          ? "Loading properties..."
                          : "No properties found for this agency."}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agent">Assigned Rental Practitioner</Label>
                <Select value={managedBy} onValueChange={setManagedBy}>
                  <SelectTrigger id="agent">
                    <SelectValue placeholder="Select practitioner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agentsQuery.data?.length ? (
                      agentsQuery.data.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.full_name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {agentsQuery.isLoading
                          ? "Loading practitioners..."
                          : "No active practitioners found."}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <Users className="size-4" /> Contract Parties
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="landlord">Landlord Party *</Label>
                  <Select value={landlordPartyId} onValueChange={setLandlordPartyId}>
                    <SelectTrigger id="landlord">
                      <SelectValue placeholder="Select landlord..." />
                    </SelectTrigger>
                    <SelectContent>
                      {partiesQuery.data?.length ? (
                        partiesQuery.data.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name} ({p.party_type})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {partiesQuery.isLoading
                            ? "Loading parties..."
                            : "No client contacts found. Add one under Clients first."}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenant">Tenant Party *</Label>
                  <Select value={tenantPartyId} onValueChange={setTenantPartyId}>
                    <SelectTrigger id="tenant">
                      <SelectValue placeholder="Select tenant..." />
                    </SelectTrigger>
                    <SelectContent>
                      {partiesQuery.data?.length ? (
                        partiesQuery.data.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name} ({p.party_type})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {partiesQuery.isLoading
                            ? "Loading parties..."
                            : "No client contacts found. Add one under Clients first."}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="occupants">Authorized Occupants</Label>
                <Input
                  id="occupants"
                  placeholder="e.g. John Smith, Sarah Smith (Children: 2)"
                  value={occupantsText}
                  onChange={(e) => setOccupantsText(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setActiveStep("step2")}>
                Next: Term & Escalation <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </TabsContent>

          {/* STEP 2: TERM & ESCALATIONS */}
          <TabsContent value="step2" className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <Calendar className="size-4" /> Lease Term & Base Rent
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start">Start Date *</Label>
                  <Input
                    id="start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end">End Date *</Label>
                  <Input
                    id="end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rent">Base Monthly Rent (ZAR) *</Label>
                <Input
                  id="rent"
                  type="number"
                  placeholder="e.g. 15000"
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <Wallet className="size-4" /> Annual Escalation & CPA Rights
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="escRate">Escalation Rate (%)</Label>
                  <Input
                    id="escRate"
                    type="number"
                    step="0.1"
                    value={escalationRatePct}
                    onChange={(e) => setEscalationRatePct(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="escMonth">Escalation Month (1-12)</Label>
                  <Select value={escalationMonth} onValueChange={setEscalationMonth}>
                    <SelectTrigger id="escMonth">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          Month {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium text-sm">Consumer Protection Act (CPA Sec 14)</div>
                  <div className="text-xs text-muted-foreground">
                    Grant 20 business days cancellation notice rights for natural person tenants.
                  </div>
                </div>
                <Switch checked={cpaNoticeApplicable} onCheckedChange={setCpaNoticeApplicable} />
              </div>
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveStep("step1")}>
                <ArrowLeft className="mr-2 size-4" /> Back
              </Button>
              <Button type="button" onClick={() => setActiveStep("step3")}>
                Next: Fees & Trust <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </TabsContent>

          {/* STEP 3: FINANCIALS & TRUST */}
          <TabsContent value="step3" className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <Wallet className="size-4" /> Security Deposit & Stakeholder
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="depAmount">Deposit Amount (ZAR)</Label>
                  <Input
                    id="depAmount"
                    type="number"
                    placeholder="e.g. 30000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="depHeld">Deposit Stakeholder</Label>
                  <Select value={depositHeldBy} onValueChange={(val: any) => setDepositHeldBy(val)}>
                    <SelectTrigger id="depHeld">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agency_trust">Agency Section 86 Trust</SelectItem>
                      <SelectItem value="landlord">Held by Landlord Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <Wallet className="size-4" /> Agency Management & Admin Fees
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mgmtFee">Monthly Mgmt Fee (%)</Label>
                  <Input
                    id="mgmtFee"
                    type="number"
                    step="0.1"
                    value={managementFeePct}
                    onChange={(e) => setManagementFeePct(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="procFee">Procurement Fee (ZAR)</Label>
                  <Input
                    id="procFee"
                    type="number"
                    placeholder="e.g. 5000"
                    value={procurementFeeRand}
                    onChange={(e) => setProcurementFeeRand(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adminFee">Lease Admin Fee (ZAR)</Label>
                  <Input
                    id="adminFee"
                    type="number"
                    value={adminFeeRand}
                    onChange={(e) => setAdminFeeRand(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Pro-Rata Move-In Rent (Auto-Calculated)</span>
                  <Badge variant="outline">
                    Method:{" "}
                    {agencySettingsQuery.data?.pro_rata_calculation_basis === "standard_30_days"
                      ? "30-Day"
                      : "Exact Calendar Days"}
                  </Badge>
                </div>
                <Input
                  id="prorata"
                  type="number"
                  value={proRataRentRand}
                  onChange={(e) => setProRataRentRand(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveStep("step2")}>
                <ArrowLeft className="mr-2 size-4" /> Back
              </Button>
              <Button type="button" onClick={() => setActiveStep("step4")}>
                Next: Compliance <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </TabsContent>

          {/* STEP 4: COMPLIANCE & INSPECTION */}
          <TabsContent value="step4" className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <ShieldCheck className="size-4" /> Statutory Verification Checks
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium text-sm">Tenant FICA & Credit Bureau Check</div>
                    <div className="text-xs text-muted-foreground">
                      Confirm proof of ID, address, and credit score verification.
                    </div>
                  </div>
                  <Switch checked={tenantFicaVerified} onCheckedChange={setTenantFicaVerified} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium text-sm">Landlord Banking Details Verified</div>
                    <div className="text-xs text-muted-foreground">
                      Confirm verified bank account for monthly rent payouts.
                    </div>
                  </div>
                  <Switch
                    checked={landlordBankVerified}
                    onCheckedChange={setLandlordBankVerified}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-card/40">
              <h4 className="font-display text-sm font-semibold text-primary flex items-center gap-2">
                <FileText className="size-4" /> Joint Inspection & Contract Generation
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="inspDate">Scheduled Ingoing Joint Inspection Date</Label>
                <Input
                  id="inspDate"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-generate-lease-doc">Auto-generate lease agreement PDF</Label>
                  <p className="text-xs text-muted-foreground">
                    Uses the admin's Lease Agreement PDF template (Admin → PDF Templates).
                  </p>
                </div>
                <Switch
                  id="auto-generate-lease-doc"
                  checked={autoGenerateLeaseDoc}
                  onCheckedChange={setAutoGenerateLeaseDoc}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 pt-2 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveStep("step3")}>
                <ArrowLeft className="mr-2 size-4" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleSubmitWizard}
                disabled={createLeaseMutation.isPending}
              >
                {createLeaseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Submitting Lease...
                  </>
                ) : (
                  "Complete Lease Onboarding"
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
