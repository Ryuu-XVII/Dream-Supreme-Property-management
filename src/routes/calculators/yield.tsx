import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalculatorShell } from "@/components/calculators/calculator-shell";
import { SliderInput } from "@/components/calculators/slider-input";
import { GlassCard } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calculators/yield")({
  head: () => ({
    meta: [
      { title: "Rental Yield Calculator | Dream Supreme Properties" },
      { name: "description", content: "Calculate gross and net rental yield, cash flow and payback period on an investment property." },
      { property: "og:title", content: "Rental Yield Calculator | Dream Supreme Properties" },
      { property: "og:description", content: "Calculate gross and net rental yield, cash flow and payback period on an investment property." },
    ],
  }),
  component: YieldCalculatorPage,
});

const zarFmt = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function YieldCalculatorPage() {
  const [price, setPrice] = useState(1_800_000);
  const [rental, setRental] = useState(15_000);
  const [rates, setRates] = useState(1_400);
  const [levy, setLevy] = useState(1_800);
  const [insurance, setInsurance] = useState(650);
  const [maintenance, setMaintenance] = useState(900);

  const { grossYield, netYield, monthlyCashFlow, annualCashFlow, payback } = useMemo(() => {
    const monthlyCosts = rates + levy + insurance + maintenance;
    const annualRental = rental * 12;
    const annualCosts = monthlyCosts * 12;
    const grossYield = (annualRental / price) * 100;
    const netYield = ((annualRental - annualCosts) / price) * 100;
    const monthlyCashFlow = rental - monthlyCosts;
    const annualCashFlow = monthlyCashFlow * 12;
    const payback = annualCashFlow > 0 ? price / annualCashFlow : Infinity;
    return { grossYield, netYield, monthlyCashFlow, annualCashFlow, payback };
  }, [price, rental, rates, levy, insurance, maintenance]);

  const positive = monthlyCashFlow >= 0;

  return (
    <CalculatorShell
      name="Rental Yield Calculator"
      description="Assess the return and cash flow of a buy-to-let investment property."
      currentPath="/calculators/yield"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="space-y-6">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">Property & income</h2>
          <SliderInput label="Purchase price" value={price} onChange={setPrice} min={200_000} max={20_000_000} step={10_000} format="zar" />
          <SliderInput label="Monthly rental income" value={rental} onChange={setRental} min={1_000} max={200_000} step={250} format="zar" />

          <h2 className="pt-2 font-display text-sm font-semibold text-muted-foreground">Monthly costs</h2>
          <SliderInput label="Rates & taxes" value={rates} onChange={setRates} min={0} max={20_000} step={50} format="zar" />
          <SliderInput label="Levy" value={levy} onChange={setLevy} min={0} max={20_000} step={50} format="zar" />
          <SliderInput label="Insurance" value={insurance} onChange={setInsurance} min={0} max={10_000} step={50} format="zar" />
          <SliderInput label="Maintenance" value={maintenance} onChange={setMaintenance} min={0} max={10_000} step={50} format="zar" />
        </GlassCard>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <GlassCard>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gross yield</p>
              <p className="money mt-2 text-2xl font-bold sm:text-3xl">{grossYield.toFixed(2)}%</p>
            </GlassCard>
            <GlassCard>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Net yield</p>
              <p className="money mt-2 text-2xl font-bold sm:text-3xl">{netYield.toFixed(2)}%</p>
            </GlassCard>
          </div>

          <GlassCard>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monthly cash flow</p>
            <p className={cn("money mt-2 text-3xl font-bold sm:text-4xl", positive ? "text-success" : "text-destructive")}>
              {positive ? "+" : ""}
              {zarFmt(monthlyCashFlow)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Annual cash flow</p>
                <p className={cn("money mt-1 text-lg font-semibold", positive ? "text-success" : "text-destructive")}>
                  {positive ? "+" : ""}
                  {zarFmt(annualCashFlow)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Simple payback period</p>
                <p className="money mt-1 text-lg font-semibold">
                  {Number.isFinite(payback) ? `${payback.toFixed(1)} yrs` : "—"}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </CalculatorShell>
  );
}
