const zarFmt = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function amortise(loanAmount: number, rate: number, years: number) {
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  const instalment =
    monthlyRate === 0
      ? loanAmount / n
      : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

  let balance = loanAmount;
  const yearly: { year: number; balance: number; cumPrincipal: number; cumInterest: number }[] = [];
  let cumPrincipal = 0;
  let cumInterest = 0;
  for (let m = 1; m <= n; m++) {
    const interest = balance * monthlyRate;
    const principal = instalment - interest;
    balance = Math.max(0, balance - principal);
    cumPrincipal += principal;
    cumInterest += interest;
    if (m % 12 === 0) {
      yearly.push({ year: m / 12, balance, cumPrincipal, cumInterest });
    }
  }
  const totalRepayment = instalment * n;
  const totalInterest = totalRepayment - loanAmount;
  return { instalment, totalRepayment, totalInterest, yearly };
}

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SliderInput } from "@/components/calculators/slider-input";
import { GlassCard } from "@/components/ui-kit";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApp } from "@/lib/app-state";

export function BondCalculator() {
  const { calculatorContext } = useApp();
  const [loanAmount, setLoanAmount] = useState(
    calculatorContext?.payload?.salePriceCents
      ? calculatorContext.payload.salePriceCents / 100
      : 1_500_000,
  );
  const [rate, setRate] = useState(11.25);
  const [term, setTerm] = useState(20);
  const [showSchedule, setShowSchedule] = useState(false);

  const { instalment, totalRepayment, totalInterest, yearly } = useMemo(
    () => amortise(loanAmount, rate, term),
    [loanAmount, rate, term],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="space-y-6">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">Loan details</h2>
          <SliderInput
            label="Loan amount"
            value={loanAmount}
            onChange={setLoanAmount}
            min={100_000}
            max={10_000_000}
            step={10_000}
            format="zar"
          />
          <SliderInput
            label="Interest rate"
            value={rate}
            onChange={setRate}
            min={7}
            max={15}
            step={0.05}
            format="pct"
          />
          <SliderInput
            label="Loan term"
            value={term}
            onChange={setTerm}
            min={5}
            max={30}
            step={1}
            format="years"
          />
        </GlassCard>

        <div className="space-y-5">
          <GlassCard>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Monthly instalment
            </p>
            <p className="money mt-2 text-3xl font-bold text-primary sm:text-4xl">
              {zarFmt(instalment)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Total interest</p>
                <p className="money mt-1 text-lg font-semibold">{zarFmt(totalInterest)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total repayment</p>
                <p className="money mt-1 text-lg font-semibold">{zarFmt(totalRepayment)}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="schedule-toggle" className="text-sm">
                Show amortisation schedule
              </Label>
              <Switch
                id="schedule-toggle"
                checked={showSchedule}
                onCheckedChange={setShowSchedule}
              />
            </div>
          </GlassCard>
        </div>
      </div>

      {showSchedule && (
        <div className="mt-5 space-y-5">
          <GlassCard>
            <h3 className="mb-4 font-display text-sm font-semibold text-muted-foreground">
              Cumulative principal vs interest
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearly} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="year"
                    tickFormatter={(v) => `Yr ${v}`}
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tickFormatter={(v) => zarFmt(v)}
                    fontSize={11}
                    width={80}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    formatter={(v: number) => zarFmt(v)}
                    labelFormatter={(l) => `Year ${l}`}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cumPrincipal"
                    name="Cumulative principal"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-chart-1)"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumInterest"
                    name="Cumulative interest"
                    stroke="var(--color-chart-2)"
                    fill="var(--color-chart-2)"
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Cumulative principal</TableHead>
                    <TableHead className="text-right">Cumulative interest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearly.map((row) => (
                    <TableRow key={row.year}>
                      <TableCell>{row.year}</TableCell>
                      <TableCell className="money text-right">{zarFmt(row.balance)}</TableCell>
                      <TableCell className="money text-right">{zarFmt(row.cumPrincipal)}</TableCell>
                      <TableCell className="money text-right">{zarFmt(row.cumInterest)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
