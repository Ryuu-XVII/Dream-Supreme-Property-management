import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { CommissionTabs } from "@/components/commission/commission-tabs";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { zar } from "@/lib/format";
import {
  Calculator,
  DollarSign,
  Percent,
  Copy,
  Check,
  Info,
  ArrowRight,
  RefreshCw,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/commission/calculator")({
  head: () => ({
    meta: [
      { title: "Commission Calculator | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Instant itemized commission breakdown, VAT resolution, franchise fees, and agent net payout calculator.",
      },
    ],
  }),
  component: CommissionCalculatorPage,
});

function CommissionCalculatorPage() {
  // Inputs
  const [salePrice, setSalePrice] = useState<number>(2_500_000);
  const [commRate, setCommRate] = useState<number>(5.0); // %
  const [isVatVendor, setIsVatVendor] = useState<boolean>(true);
  const [isVatInclusive, setIsVatInclusive] = useState<boolean>(true);
  const [franchiseFeePct, setFranchiseFeePct] = useState<number>(6.0); // %
  const [referralFeePct, setReferralFeePct] = useState<number>(0.0); // %
  const [officeSharePct, setOfficeSharePct] = useState<number>(50.0); // %
  const [agentASplitPct, setAgentASplitPct] = useState<number>(60.0); // %
  const [agentBSplitPct, setAgentBSplitPct] = useState<number>(40.0); // %
  const [hasCoAgent, setHasCoAgent] = useState<boolean>(false);
  const [advanceDeduction, setAdvanceDeduction] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Calculations
  const calc = useMemo(() => {
    const salePriceCents = salePrice * 100;
    const grossCommCents = Math.round((salePriceCents * commRate) / 100);

    let vatCents = 0;
    let netCommCents = grossCommCents;

    if (isVatVendor) {
      if (isVatInclusive) {
        netCommCents = Math.round(grossCommCents / 1.15);
        vatCents = grossCommCents - netCommCents;
      } else {
        vatCents = Math.round(grossCommCents * 0.15);
      }
    }

    const franchiseDeductionCents = Math.round((netCommCents * franchiseFeePct) / 100);
    const referralDeductionCents = Math.round((netCommCents * referralFeePct) / 100);
    const distributablePoolCents = netCommCents - franchiseDeductionCents - referralDeductionCents;

    const officeShareCents = Math.round((distributablePoolCents * officeSharePct) / 100);
    const agentPoolCents = distributablePoolCents - officeShareCents;

    let agentAPayoutCents = agentPoolCents;
    let agentBPayoutCents = 0;

    if (hasCoAgent) {
      agentAPayoutCents = Math.round((agentPoolCents * agentASplitPct) / 100);
      agentBPayoutCents = agentPoolCents - agentAPayoutCents;
    }

    const agentANetCents = Math.max(0, agentAPayoutCents - advanceDeduction * 100);

    return {
      grossCommCents,
      vatCents,
      netCommCents,
      franchiseDeductionCents,
      referralDeductionCents,
      distributablePoolCents,
      officeShareCents,
      agentPoolCents,
      agentAPayoutCents,
      agentBPayoutCents,
      agentANetCents,
    };
  }, [
    salePrice,
    commRate,
    isVatVendor,
    isVatInclusive,
    franchiseFeePct,
    referralFeePct,
    officeSharePct,
    agentASplitPct,
    hasCoAgent,
    advanceDeduction,
  ]);

  const copySummary = () => {
    const summaryText = `
--- DREAM SUPREME PROPERTIES COMMISSION CALCULATION ---
Property Sale Price: ${zar(salePrice * 100)}
Commission Rate: ${commRate}% (${isVatInclusive ? "VAT-Inclusive" : "VAT-Exclusive"})
Gross Commission: ${zar(calc.grossCommCents)}
VAT Portion (15%): ${zar(calc.vatCents)}
Net Commission: ${zar(calc.netCommCents)}
------------------------------------------------------
Franchise Fee (${franchiseFeePct}%): -${zar(calc.franchiseDeductionCents)}
Distributable Pool: ${zar(calc.distributablePoolCents)}
Office Share (${officeSharePct}%): ${zar(calc.officeShareCents)}
Agent Pool (${100 - officeSharePct}%): ${zar(calc.agentPoolCents)}
------------------------------------------------------
Primary Agent Payout: ${zar(calc.agentAPayoutCents)}
${advanceDeduction > 0 ? `Less Advance Recovery: -${zar(advanceDeduction * 100)}\n` : ""}NET AGENT PAYABLE: ${zar(calc.agentANetCents)}
======================================================
`;
    navigator.clipboard.writeText(summaryText.trim());
    setCopied(true);
    toast.success("Commission summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell
      title="Commission Calculator"
      description="Calculate gross commission, VAT deductions, franchise splits, and net agent payout in real-time."
      crumbs={[{ label: "Commission", to: "/commission" }, { label: "Calculator" }]}
    >
      <CommissionTabs />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Input Parameters Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <GlassCard>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-display font-semibold text-base flex items-center gap-2">
                <Calculator className="size-4 text-primary" /> Deal Financial Inputs
              </h3>
              <Badge
                variant="outline"
                className="text-xs bg-primary/10 text-primary border-primary/20"
              >
                SA Practice Rules
              </Badge>
            </div>

            <div className="mt-4 space-y-5">
              {/* Sale Price */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <Label className="font-medium text-sm">Agreed Sale Price (R)</Label>
                  <span className="money font-semibold text-primary">{zar(salePrice * 100)}</span>
                </div>
                <Input
                  type="number"
                  value={salePrice || ""}
                  onChange={(e) => setSalePrice(Number(e.target.value))}
                  placeholder="e.g. 2500000"
                  className="font-mono text-base"
                />
                <Slider
                  min={500000}
                  max={20000000}
                  step={50000}
                  value={[salePrice]}
                  onValueChange={(val) => setSalePrice(val[0])}
                  className="pt-1"
                />
              </div>

              {/* Commission Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <Label className="font-medium text-sm">Commission Rate (%)</Label>
                  <span className="font-semibold text-primary">{commRate}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.1"
                    value={commRate || ""}
                    onChange={(e) => setCommRate(Number(e.target.value))}
                    className="font-mono text-base max-w-[120px]"
                  />
                  <Slider
                    min={1}
                    max={10}
                    step={0.25}
                    value={[commRate]}
                    onValueChange={(val) => setCommRate(val[0])}
                    className="flex-1"
                  />
                </div>
              </div>

              <Separator />

              {/* VAT Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Agency VAT Vendor</Label>
                    <p className="text-[11px] text-muted-foreground">Charge 15% SA VAT</p>
                  </div>
                  <Switch checked={isVatVendor} onCheckedChange={setIsVatVendor} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/40">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Rate Includes VAT</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {commRate}% is VAT-Inclusive
                    </p>
                  </div>
                  <Switch
                    checked={isVatInclusive}
                    onCheckedChange={setIsVatInclusive}
                    disabled={!isVatVendor}
                  />
                </div>
              </div>

              <Separator />

              {/* Deductions & Splits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Franchise / Royalty Fee (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={franchiseFeePct}
                    onChange={(e) => setFranchiseFeePct(Number(e.target.value))}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Office Share (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={officeSharePct}
                    onChange={(e) => setOfficeSharePct(Number(e.target.value))}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Co-Agent Toggle */}
              <div className="p-3 rounded-lg border border-border bg-card/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Co-Mandate / Second Agent Split</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Split agent pool between 2 practitioners
                    </p>
                  </div>
                  <Switch checked={hasCoAgent} onCheckedChange={setHasCoAgent} />
                </div>

                {hasCoAgent && (
                  <div className="pt-2 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px]">Primary Agent Share (%)</Label>
                      <Input
                        type="number"
                        value={agentASplitPct}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setAgentASplitPct(val);
                          setAgentBSplitPct(100 - val);
                        }}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Secondary Agent Share (%)</Label>
                      <Input
                        type="number"
                        value={agentBSplitPct}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setAgentBSplitPct(val);
                          setAgentASplitPct(100 - val);
                        }}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Advance Recovery */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Advance Recovery / Desk Fee (R)</Label>
                <Input
                  type="number"
                  value={advanceDeduction || ""}
                  onChange={(e) => setAdvanceDeduction(Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Results Card & Breakdown (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="relative overflow-hidden border-primary/30">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-success/10" />

            <div className="relative">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Net Agent Payable
                </span>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={copySummary}>
                  {copied ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy Summary"}
                </Button>
              </div>

              <div className="mt-4">
                <p className="money text-4xl font-extrabold tracking-tight text-primary">
                  {zar(calc.agentANetCents)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Primary practitioner net take-home from this deal
                </p>
              </div>

              {/* Itemized Calculation Waterfall */}
              <div className="mt-6 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Gross Commission ({commRate}%)</span>
                  <span className="font-semibold">{zar(calc.grossCommCents)}</span>
                </div>

                {isVatVendor && (
                  <>
                    <div className="flex justify-between py-1 border-b border-border/50 text-muted-foreground">
                      <span>Less SARS VAT (15%)</span>
                      <span className="text-destructive">-{zar(calc.vatCents)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50 font-medium">
                      <span>Net Commission Excl. VAT</span>
                      <span>{zar(calc.netCommCents)}</span>
                    </div>
                  </>
                )}

                {franchiseFeePct > 0 && (
                  <div className="flex justify-between py-1 border-b border-border/50 text-muted-foreground">
                    <span>Less Franchise / Royalty ({franchiseFeePct}%)</span>
                    <span className="text-destructive">-{zar(calc.franchiseDeductionCents)}</span>
                  </div>
                )}

                <div className="flex justify-between py-1 border-b border-border/50 font-medium text-primary">
                  <span>Distributable Agency Pool</span>
                  <span>{zar(calc.distributablePoolCents)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50 text-muted-foreground">
                  <span>Office Share ({officeSharePct}%)</span>
                  <span>{zar(calc.officeShareCents)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50 font-semibold">
                  <span>Total Agent Pool ({100 - officeSharePct}%)</span>
                  <span>{zar(calc.agentPoolCents)}</span>
                </div>

                {hasCoAgent && (
                  <>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span>Primary Agent ({agentASplitPct}%)</span>
                      <span className="font-semibold text-primary">
                        {zar(calc.agentAPayoutCents)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span>Secondary Agent ({agentBSplitPct}%)</span>
                      <span className="font-semibold text-muted-foreground">
                        {zar(calc.agentBPayoutCents)}
                      </span>
                    </div>
                  </>
                )}

                {advanceDeduction > 0 && (
                  <div className="flex justify-between py-1 border-b border-border/50 text-destructive">
                    <span>Less Advance / Desk Fee Recovery</span>
                    <span>-{zar(advanceDeduction * 100)}</span>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
