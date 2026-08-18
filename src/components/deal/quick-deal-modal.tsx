import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createDeal, createMandate } from "@/data/deals";
import { useAgents } from "@/data/reference";
import { useAuth } from "@/lib/auth";
import {
  Home,
  User,
  DollarSign,
  Calendar,
  ShieldCheck,
  FileCheck,
  PlusCircle,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";

import {
  validateEmailFormat,
  validateSouthAfricanId,
  validateSouthAfricanPhone,
} from "@/lib/sa-validation";

interface QuickDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (dealId: string) => void;
  initialType?: "deal" | "mandate";
}

export function QuickDealModal({
  open,
  onOpenChange,
  onSuccess,
  initialType = "deal",
}: QuickDealModalProps) {
  const { isReadOnly, account } = useAuth();
  // Mirrors enforce_admin_only_commission_rate in the database: an agent may
  // capture a mandate or deal, but not set what the agency earns on it.
  const canEditCommission = (account?.role ?? "").toLowerCase().includes("admin");
  const { data: agents = [] } = useAgents();
  const [entryType, setEntryType] = useState<"deal" | "mandate">(initialType);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  // setLoading(true) doesn't disable the submit button until the next render,
  // so a fast double-click (or a double form-submit event) can fire this
  // handler twice before React re-renders `disabled`. A synchronous ref guard
  // closes that gap and stops the RPC from being called twice.
  const submittingRef = useRef(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: string[] = [];
    const maxPhotoSize = 10 * 1024 * 1024; // 10MB cap

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`File "${file.name}" is not an image.`);
        return;
      }
      if (file.size > maxPhotoSize) {
        toast.error(`Image "${file.name}" exceeds maximum allowed size of 10MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const [form, setForm] = useState({
    // Property Details
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

    // Mandate & Pricing Details
    mandateType: "Sole",
    listingPrice: "2500000",
    agreedCommissionPct: "5.0",
    mandateStartDate: new Date().toISOString().split("T")[0],
    mandateExpiryDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    agentId: "",

    // Seller (Mandator) Details & FICA
    sellerName: "",
    sellerEmail: "",
    sellerMobile: "",
    sellerIdNumber: "",
    sellerTaxNumber: "",
    sellerFica: "Complete",
    popiaConsentSigned: true,

    // Purchaser Details (For OTP / Deal)
    buyerName: "",
    buyerEmail: "",
    buyerMobile: "",
    buyerIdNumber: "",
    buyerFica: "Partial",

    // Deal Financials
    salePrice: "2450000",
    otpSigned: new Date().toISOString().split("T")[0],
    occupationDate: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
    conveyancer: "Vogel & Associates Attorneys",

    // Suspensive Conditions
    bondRequired: true,
    bondAmount: "2000000",
    bondDueDate: new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0],
    ficaRequired: true,
    ficaDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  });

  const update = (key: string, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to save records.");

    if (!form.address.trim() || !form.suburb.trim()) {
      toast.error("Please fill in property street address and suburb.");
      return;
    }
    if (!form.sellerName.trim()) {
      toast.error("Please fill in seller/mandator full name.");
      return;
    }
    if (form.sellerEmail.trim() && !validateEmailFormat(form.sellerEmail)) {
      toast.error("Please enter a valid seller email address.");
      return;
    }
    if (form.sellerMobile.trim()) {
      const phoneRes = validateSouthAfricanPhone(form.sellerMobile);
      if (!phoneRes.valid) {
        toast.error(
          phoneRes.error || "Please enter a valid South African mobile number for seller.",
        );
        return;
      }
    }
    if (form.sellerIdNumber.trim()) {
      const idRes = validateSouthAfricanId(form.sellerIdNumber);
      if (!idRes.valid) {
        toast.error(idRes.error || "Please enter a valid South African ID number for seller.");
        return;
      }
    }

    const listingPriceNum = Number(form.listingPrice);
    if (!listingPriceNum || listingPriceNum <= 0 || listingPriceNum > 1_000_000_000) {
      toast.error("Please enter a valid listing price (up to R1 billion).");
      return;
    }

    const commPct = Number(form.agreedCommissionPct);
    if (isNaN(commPct) || commPct < 0 || commPct > 100) {
      toast.error("Commission percentage must be between 0% and 100%.");
      return;
    }

    if (entryType === "deal") {
      if (!form.buyerName.trim()) {
        toast.error("Please fill in purchaser name for an active deal.");
        return;
      }
      if (form.buyerEmail.trim() && !validateEmailFormat(form.buyerEmail)) {
        toast.error("Please enter a valid purchaser email address.");
        return;
      }
      if (form.buyerMobile.trim()) {
        const phoneRes = validateSouthAfricanPhone(form.buyerMobile);
        if (!phoneRes.valid) {
          toast.error(
            phoneRes.error || "Please enter a valid South African mobile number for purchaser.",
          );
          return;
        }
      }
      if (form.buyerIdNumber.trim()) {
        const idRes = validateSouthAfricanId(form.buyerIdNumber);
        if (!idRes.valid) {
          toast.error(idRes.error || "Please enter a valid South African ID number for purchaser.");
          return;
        }
      }
      const salePriceNum = Number(form.salePrice);
      if (!salePriceNum || salePriceNum <= 0 || salePriceNum > 1_000_000_000) {
        toast.error("Please enter a valid agreed sale price (up to R1 billion).");
        return;
      }
    }

    try {
      submittingRef.current = true;
      setLoading(true);
      toast.loading(
        entryType === "mandate" ? "Saving mandate record..." : "Saving deal record...",
        { id: "quick-deal" },
      );

      const recordId =
        entryType === "mandate"
          ? await createMandate(form)
          : await createDeal({
              ...form,
              commissionBps: (parseFloat(form.agreedCommissionPct || "5") * 100).toString(),
              mandateSigned: form.mandateStartDate,
              mandateExpiry: form.mandateExpiryDate,
              effectiveDate: form.otpSigned,
              salePrice: form.salePrice,
            });

      toast.success(
        entryType === "deal"
          ? "Deal created and saved successfully!"
          : "Sole/Joint Mandate registered successfully!",
        { id: "quick-deal" },
      );
      onOpenChange(false);
      if (onSuccess) onSuccess(recordId);
    } catch (err: any) {
      toast.error(`Failed to record mandate: ${err.message}`, { id: "quick-deal" });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <PlusCircle className="size-5 text-primary" />
            {entryType === "mandate"
              ? "Register Property Listing / Mandate"
              : "Quick Deal & OTP Capture"}
          </DialogTitle>
          <DialogDescription>
            South African Estate Agency Affairs Board (EAAB) & FICA compliant listing registration.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2">
          <Tabs value={entryType} onValueChange={(v) => setEntryType(v as "deal" | "mandate")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mandate">Property Listing (Mandate Agreement)</TabsTrigger>
              <TabsTrigger value="deal">Full Deal (Signed OTP)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Property Location & Attributes */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-card/50">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Home className="size-3.5 text-primary" /> Property Information
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-xs font-semibold">Property Category</Label>
                <Select value={form.propertyType} onValueChange={(v) => update("propertyType", v)}>
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
                <Label className="text-xs font-semibold">Asking Listing Price (ZAR) *</Label>
                <Input
                  type="number"
                  value={form.listingPrice}
                  onChange={(e) => update("listingPrice", e.target.value)}
                  required
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Property Photos</Label>
                <p className="text-[11px] text-muted-foreground">
                  Preview only — photos are not saved with this record. Attach property images from
                  the deal&apos;s Documents tab after creation.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {photos.map((url, i) => (
                    <div
                      key={url}
                      className="group relative size-16 overflow-hidden rounded-lg border border-border"
                    >
                      <img
                        src={url}
                        alt={`Property photo ${i + 1}`}
                        className="size-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        aria-label={`Remove property photo ${i + 1}`}
                        className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex size-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-input bg-background/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    <Upload className="size-4" />
                    <span className="mt-1 text-[9px] font-medium">Add Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Mandate Agreement & Expiry Terms */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-card/50">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <FileCheck className="size-3.5 text-primary" /> Mandate Terms & Commission
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mandate Type</Label>
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
                <Label className="text-xs font-semibold">Agreed Commission (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.agreedCommissionPct}
                  onChange={(e) => update("agreedCommissionPct", e.target.value)}
                  readOnly={!canEditCommission}
                  disabled={!canEditCommission}
                  className={
                    canEditCommission ? undefined : "cursor-not-allowed bg-muted/60 opacity-70"
                  }
                />
                {!canEditCommission && (
                  <p className="text-[11px] text-muted-foreground">
                    Set by your agency&apos;s commission rules.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Listing Agent</Label>
                <Select value={form.agentId} onValueChange={(v) => update("agentId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
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

              <div className="space-y-1 col-span-2">
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

          {/* Section 3: Seller (Mandator) FICA & Identity */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-card/50">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" /> Seller (Mandator) Details & FICA
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-xs font-semibold">Seller Email</Label>
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

          {/* Additional Purchaser Fields if Full Deal */}
          {entryType === "deal" && (
            <div className="rounded-lg border border-border p-3 space-y-3 bg-card/50">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <User className="size-3.5 text-primary" /> Purchaser & OTP Agreement Details
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Purchaser Full Name *</Label>
                  <Input
                    placeholder="e.g. Mary Jane"
                    value={form.buyerName}
                    onChange={(e) => update("buyerName", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Purchaser ID / Passport</Label>
                  <Input
                    placeholder="e.g. 9005125028081"
                    value={form.buyerIdNumber}
                    onChange={(e) => update("buyerIdNumber", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Agreed Sale Price (ZAR)</Label>
                  <Input
                    type="number"
                    value={form.salePrice}
                    onChange={(e) => update("salePrice", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">OTP Signed Date</Label>
                  <Input
                    type="date"
                    value={form.otpSigned}
                    onChange={(e) => update("otpSigned", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || isReadOnly}>
              {isReadOnly
                ? "Read-Only Mode"
                : loading
                  ? "Saving..."
                  : entryType === "deal"
                    ? "Create Deal & Initialize OTP"
                    : "Register Mandate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
