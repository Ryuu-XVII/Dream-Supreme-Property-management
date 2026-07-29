import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { CalculatorShell } from "@/components/calculators/calculator-shell";
import { SliderInput } from "@/components/calculators/slider-input";
import { GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/calculators/affordability")({
  head: () => ({
    meta: [
      { title: "Bond Affordability Calculator | Dream Supreme Properties" },
      { name: "description", content: "Work out the maximum loan and purchase price you can afford based on your income." },
      { property: "og:title", content: "Bond Affordability Calculator | Dream Supreme Properties" },
      { property: "og:description", content: "Work out the maximum loan and purchase price you can afford based on your income." },
    ],
  }),
  component: AffordabilityCalculatorPage,
});

const zarFmt = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const GUIDELINE = 30;

function AffordabilityCalculatorPage() {
  const [income, setIncome] = useState(65_000);
  const [expenses, setExpenses] = useState(12_000);
  const [rate, setRate] = useState(11.25);
  const [term, setTerm] = useState(20);

  const { maxInstalment, maxLoan, maxPurchasePrice, dti } = useMemo(() => {
    const maxInstalment = income * (GUIDELINE / 100);
    const monthlyRate = rate / 100 / 12;
    const n = term * 12;
    const maxLoan =
      monthlyRate === 0
        ? maxInstalment * n
        : (maxInstalment * (1 - Math.pow(1 + monthlyRate, -n))) / monthlyRate;
    const maxPurchasePrice = maxLoan / 0.9; // assume 10% deposit guideline
    const dti = ((expenses + maxInstalment) / income) * 100;
    return { maxInstalment, maxLoan, maxPurchasePrice, dti };
  }, [income, expenses, rate, term]);

  const gaugeValue = Math.min(dti, 60);
  const gaugeData = [{ name: "DTI", value: gaugeValue, fill: dti > GUIDELINE ? "var(--destructive)" : "var(--color-chart-2)" }];

  return (
    <CalculatorShell
      name="Bond Affordability Calculator"
      description="Estimate the maximum loan and purchase price you qualify for."
      currentPath="/calculators/affordability"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="space-y-6">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">Income & commitments</h2>
          <SliderInput label="Gross monthly income" value={income} onChange={setIncome} min={10_000} max={500_000} step={500} format="zar" />
          <SliderInput label="Total monthly expenses / debt" value={expenses} onChange={setExpenses} min={0} max={200_000} step={500} format="zar" />
          <SliderInput label="Interest rate" value={rate} onChange={setRate} min={7} max={15} step={0.05} format="pct" />
          <SliderInput label="Loan term" value={term} onChange={setTerm} min={5} max={30} step={1} format="years" />
        </GlassCard>

        <div className="space-y-5">
          <GlassCard>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Maximum monthly instalment</p>
            <p className="money mt-2 text-3xl font-bold text-primary sm:text-4xl">{zarFmt(maxInstalment)}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Maximum loan amount</p>
                <p className="money mt-1 text-lg font-semibold">{zarFmt(maxLoan)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Maximum purchase price</p>
                <p className="money mt-1 text-lg font-semibold">{zarFmt(maxPurchasePrice)}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-muted-foreground">Debt-to-income ratio</h3>
              <span className={dti > GUIDELINE ? "text-xs font-medium text-destructive" : "text-xs font-medium text-success"}>
                {dti.toFixed(1)}% {dti > GUIDELINE ? "· above guideline" : "· within guideline"}
              </span>
            </div>
            <div className="relative h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="100%"
                  barSize={16}
                  data={gaugeData}
                  startAngle={210}
                  endAngle={-30}
                >
                  <PolarAngleAxis type="number" domain={[0, 60]} angleAxisId={0} tick={false} />
                  <RadialBar background dataKey="value" cornerRadius={8} angleAxisId={0} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="money text-2xl font-bold">{dti.toFixed(0)}%</span>
                <span className="text-[11px] text-muted-foreground">of gross income</span>
              </div>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Guideline marker: banks typically cap total debt obligations at {GUIDELINE}% of gross income.
            </p>
          </GlassCard>
        </div>
      </div>
    </CalculatorShell>
  );
}
