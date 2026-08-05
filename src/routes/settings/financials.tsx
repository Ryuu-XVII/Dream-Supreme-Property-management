import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Coins, Target, TrendingUp, Percent, Wallet, Award } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard, KpiCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zar, zarCompact } from "@/lib/format";

export const Route = createFileRoute("/settings/financials")({
  head: () => ({
    meta: [
      { title: "Financials & Goals | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "View your commission split, desk fees and set personal sales and mandate targets.",
      },
    ],
  }),
  component: FinancialsPage,
});

function FinancialsPage() {
  const [mandateTarget, setMandateTarget] = useState(4);
  const [salesTarget, setSalesTarget] = useState(3000000);
  const [gciTarget, setGciTarget] = useState(150000);
  const [saving, setSaving] = useState(false);

  function handleSaveTargets(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Performance targets updated successfully");
    }, 400);
  }

  return (
    <AppShell title="Settings" description="View your financial terms and manage your targets.">
      <SettingsTabs />
      <div className="space-y-6">
        {/* Financial Transparency Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Active Commission Split"
            value="70 %"
            sub="Agent portion (30% Agency)"
            icon={Percent}
            delay={0}
          />
          <KpiCard
            label="Monthly Desk Fee"
            value={zar(2500)}
            sub="Deducted monthly"
            icon={Wallet}
            delay={0.05}
          />
          <KpiCard
            label="Royalty Contribution"
            value="5.0 %"
            sub="Franchise royalty fee"
            icon={Award}
            delay={0.1}
          />
          <KpiCard
            label="YTD Gross Earned"
            value={zarCompact(485000)}
            sub="Year-to-date GCI"
            icon={TrendingUp}
            delay={0.15}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Editable Targets Card */}
          <GlassCard className="lg:col-span-2">
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Target className="size-4 text-primary" /> Monthly & Quarterly Performance Targets
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Set your personal targets to drive progress metrics on your main dashboard.
            </p>

            <form onSubmit={handleSaveTargets} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mandateTarget">Monthly Mandates Goal</Label>
                  <Input
                    id="mandateTarget"
                    type="number"
                    value={mandateTarget}
                    onChange={(e) => setMandateTarget(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">Listings / Month</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="salesTarget">Monthly Sales Target (ZAR)</Label>
                  <Input
                    id="salesTarget"
                    type="number"
                    value={salesTarget}
                    onChange={(e) => setSalesTarget(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Volume target: {zarCompact(salesTarget)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gciTarget">Monthly GCI Target (ZAR)</Label>
                  <Input
                    id="gciTarget"
                    type="number"
                    value={gciTarget}
                    onChange={(e) => setGciTarget(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Commission goal: {zarCompact(gciTarget)}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving Targets..." : "Save Targets"}
                </Button>
              </div>
            </form>
          </GlassCard>

          {/* Financial Breakdown Info */}
          <GlassCard className="lg:col-span-1">
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Coins className="size-4 text-primary" /> Commission Terms
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Contract terms agreed with Agency Principal
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Base Split</span>
                <span className="font-semibold">70.0%</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Performance Tier</span>
                <span className="font-semibold text-success">Senior Agent</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Payout Schedule</span>
                <span className="font-medium">On Registration</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desk Fee Status</span>
                <span className="font-medium text-success">Up-to-date</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
