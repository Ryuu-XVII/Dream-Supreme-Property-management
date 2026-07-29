import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createDeal } from "@/data/deals";
import { Home, User, DollarSign, PlusCircle } from "lucide-react";

interface QuickDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (dealId: string) => void;
}

export function QuickDealModal({ open, onOpenChange, onSuccess }: QuickDealModalProps) {
  const [entryType, setEntryType] = useState<"deal" | "mandate">("deal");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    address: "",
    suburb: "",
    city: "Johannesburg",
    propertyType: "Freehold House",
    beds: "3",
    baths: "2",
    garages: "2",
    floorSize: "180",
    erfSize: "500",

    mandateType: "Sole",
    listingPrice: "2500000",
    commissionBps: "500",

    sellerName: "",
    sellerEmail: "",
    sellerMobile: "",
    sellerFica: "Complete",

    buyerName: "",
    buyerEmail: "",
    buyerMobile: "",
    buyerFica: "Partial",

    salePrice: "2450000",
    otpSigned: new Date().toISOString().split("T")[0],
    occupationDate: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
    conveyancer: "Vogel & Associates Attorneys",
    agentId: "",

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
    if (!form.address || !form.sellerName) {
      toast.error("Please fill in property address and seller name.");
      return;
    }

    if (entryType === "deal" && !form.buyerName) {
      toast.error("Please fill in buyer name for an active deal.");
      return;
    }

    try {
      setLoading(true);
      toast.loading("Saving to Supabase...", { id: "quick-deal" });

      const dealId = await createDeal({
        ...form,
        buyerName: entryType === "mandate" ? "Unassigned Purchaser" : form.buyerName,
      });

      toast.success(entryType === "deal" ? "Deal created successfully!" : "Mandate logged successfully!", { id: "quick-deal" });
      onOpenChange(false);
      if (onSuccess) onSuccess(dealId);
    } catch (err: any) {
      toast.error(`Failed to create: ${err.message}`, { id: "quick-deal" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <PlusCircle className="size-5 text-primary" /> Quick Capture
          </DialogTitle>
          <DialogDescription>
            Log a signed Mandate or full Offer to Purchase (Deal) in under 30 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2">
          <Tabs value={entryType} onValueChange={(v) => setEntryType(v as "deal" | "mandate")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deal">Full Deal (Signed OTP)</TabsTrigger>
              <TabsTrigger value="mandate">Mandate Only (Listing)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property Line */}
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
              <Label className="text-xs font-semibold">Suburb</Label>
              <Input
                placeholder="e.g. Morningside"
                value={form.suburb}
                onChange={(e) => update("suburb", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Listing Price (R)</Label>
              <Input
                type="number"
                value={form.listingPrice}
                onChange={(e) => update("listingPrice", e.target.value)}
              />
            </div>
          </div>

          {/* Seller & Buyer */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Seller Name *</Label>
              <Input
                placeholder="e.g. John Smith"
                value={form.sellerName}
                onChange={(e) => update("sellerName", e.target.value)}
                required
              />
            </div>

            {entryType === "deal" ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Buyer Name *</Label>
                <Input
                  placeholder="e.g. Mary Jane"
                  value={form.buyerName}
                  onChange={(e) => update("buyerName", e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mandate Type</Label>
                <Select value={form.mandateType} onValueChange={(v) => update("mandateType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sole">Sole Mandate</SelectItem>
                    <SelectItem value="Joint">Joint Mandate</SelectItem>
                    <SelectItem value="Open">Open Mandate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Agreed Financials if Deal */}
          {entryType === "deal" && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Agreed Sale Price (R)</Label>
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
          )}

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : entryType === "deal" ? "Create Deal" : "Log Mandate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
