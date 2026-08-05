import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PenTool, CheckCircle, FileCheck, Building, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
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
import { conveyancerFirms } from "@/data/state";

export const Route = createFileRoute("/settings/preferences")({
  head: () => ({
    meta: [
      { title: "Signing & Presets | Dream Supreme Properties" },
      {
        name: "description",
        content: "Manage your digital e-signature, page initials and default deal presets.",
      },
    ],
  }),
  component: PreferencesPage,
});

function PreferencesPage() {
  const [signatureType, setSignatureType] = useState<"draw" | "type">("type");
  const [typedName, setTypedName] = useState("Jane Doe");
  const [initialsText, setInitialsText] = useState("JD");
  const [defaultRateBps, setDefaultRateBps] = useState(500); // 5.00%
  const [defaultFirmId, setDefaultFirmId] = useState(conveyancerFirms[0]?.id ?? "");

  function handleSaveSignature() {
    toast.success("E-signature stamp updated successfully");
  }

  function handleSavePresets(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Default deal presets updated");
  }

  return (
    <AppShell title="Settings" description="Manage your digital signature and deal presets.">
      <SettingsTabs />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* E-Signature Card */}
        <GlassCard className="lg:col-span-2">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <PenTool className="size-4 text-primary" /> Digital Signature & Initials
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Your saved signature will automatically populate onto digital OTPs and mandates.
          </p>

          <div className="space-y-6">
            <div className="flex gap-2 border-b border-border pb-4">
              <Button
                variant={signatureType === "type" ? "default" : "outline"}
                size="sm"
                onClick={() => setSignatureType("type")}
              >
                Type Signature
              </Button>
              <Button
                variant={signatureType === "draw" ? "default" : "outline"}
                size="sm"
                onClick={() => setSignatureType("draw")}
              >
                Draw Signature
              </Button>
            </div>

            {signatureType === "type" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Full Name for Signature</Label>
                  <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Initials Stamp</Label>
                  <Input value={initialsText} onChange={(e) => setInitialsText(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Draw signature inside the box below
                </p>
                <div className="h-28 w-full rounded bg-muted/40 flex items-center justify-center font-serif text-2xl italic text-primary/80">
                  [ Draw Canvas Signature Pad ]
                </div>
              </div>
            )}

            {/* Signature Preview Card */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Live Stamp Preview
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Digital Signature</p>
                  <p className="font-serif text-2xl italic text-primary">
                    {typedName || "Jane Doe"}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">Page Initials</p>
                  <p className="font-mono text-xl font-bold tracking-widest text-primary">
                    {initialsText || "JD"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSignature}>Save Digital Signature</Button>
            </div>
          </div>
        </GlassCard>

        {/* Deal Presets Card */}
        <GlassCard className="lg:col-span-1">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Default Deal Presets
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Pre-fill defaults when starting a new deal
          </p>

          <form onSubmit={handleSavePresets} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Preferred Conveyancer</Label>
              <Select value={defaultFirmId} onValueChange={setDefaultFirmId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select firm..." />
                </SelectTrigger>
                <SelectContent>
                  {conveyancerFirms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Default Commission Rate (%)</Label>
              <Input
                type="number"
                step="0.25"
                value={defaultRateBps / 100}
                onChange={(e) => setDefaultRateBps(Number(e.target.value) * 100)}
                className="h-9 font-mono text-xs"
              />
            </div>

            <Button type="submit" variant="outline" size="sm" className="w-full text-xs mt-2">
              Save Deal Presets
            </Button>
          </form>
        </GlassCard>
      </div>
    </AppShell>
  );
}
