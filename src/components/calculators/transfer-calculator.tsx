const zarFmt = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// brackets are stored in cents
function calcDuty(priceCents: number) {
  return calculateTransferDutyCents(priceCents, TRANSFER_DUTY_FALLBACK);
}

function conveyancingFee(priceRands: number) {
  // sensible sliding scale, in Rands
  if (priceRands <= 500_000) return 12_500;
  if (priceRands <= 1_000_000) return 12_500 + (priceRands - 500_000) * 0.014;
  if (priceRands <= 2_000_000) return 19_500 + (priceRands - 1_000_000) * 0.011;
  if (priceRands <= 5_000_000) return 30_500 + (priceRands - 2_000_000) * 0.008;
  return 54_500 + (priceRands - 5_000_000) * 0.005;
}

function bondRegistrationCost(bondRands: number) {
  if (bondRands <= 0) return 0;
  if (bondRands <= 500_000) return 9_500;
  if (bondRands <= 1_000_000) return 9_500 + (bondRands - 500_000) * 0.011;
  if (bondRands <= 2_000_000) return 15_000 + (bondRands - 1_000_000) * 0.009;
  return 24_000 + (bondRands - 2_000_000) * 0.006;
}

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { TRANSFER_DUTY_FALLBACK } from "@/lib/financial-config";
import { calculateTransferDutyCents } from "@/lib/domain";
import { useApp } from "@/lib/app-state";

export function TransferCalculator() {
  const { calculatorContext } = useApp();
  const [price, setPrice] = useState(
    calculatorContext?.payload?.salePriceCents
      ? calculatorContext.payload.salePriceCents / 100
      : 1_800_000,
  );
  const [bondAmount, setBondAmount] = useState(
    calculatorContext?.payload?.salePriceCents
      ? calculatorContext.payload.salePriceCents / 100
      : 1_400_000,
  );
  const [vatVendor, setVatVendor] = useState(false);

  const priceCents = price * 100;
  const { duty: dutyCents, bracket } = useMemo(() => calcDuty(priceCents), [priceCents]);
  const duty = vatVendor ? 0 : dutyCents / 100;

  const conveyancing = useMemo(() => conveyancingFee(price), [price]);
  const deedsOffice = price <= 1_000_000 ? 750 : price <= 5_000_000 ? 1_800 : 3_500;
  const postagePetties = 3_850;
  const bondRegistration = useMemo(() => bondRegistrationCost(bondAmount), [bondAmount]);

  const total = duty + conveyancing + deedsOffice + postagePetties + bondRegistration;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="space-y-6">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            Purchase details
          </h2>
          <SliderInput
            label="Purchase price"
            value={price}
            onChange={setPrice}
            min={200_000}
            max={20_000_000}
            step={10_000}
            format="zar"
          />
          <SliderInput
            label="Bond amount"
            value={bondAmount}
            onChange={setBondAmount}
            min={0}
            max={20_000_000}
            step={10_000}
            format="zar"
          />
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
            <div className="min-w-0">
              <Label htmlFor="vat-toggle" className="text-sm">
                Seller is a VAT vendor
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Sale is subject to VAT instead of transfer duty
              </p>
            </div>
            <Switch id="vat-toggle" checked={vatVendor} onCheckedChange={setVatVendor} />
          </div>
          {vatVendor && (
            <p className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-info-foreground">
              No transfer duty payable — sale is subject to VAT.
            </p>
          )}
        </GlassCard>

        <div className="space-y-5">
          <GlassCard>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total transfer costs
            </p>
            <p className="money mt-2 text-3xl font-bold text-primary sm:text-4xl">
              {zarFmt(total)}
            </p>
            <div className="mt-5 space-y-2.5 border-t border-border/60 pt-4 text-sm">
              <Row label="Transfer duty" value={duty} />
              <Row label="Conveyancing fees (incl. VAT est.)" value={conveyancing} />
              <Row label="Deeds office fees" value={deedsOffice} />
              <Row label="Postage & petties" value={postagePetties} />
              {bondAmount > 0 && <Row label="Bond registration cost" value={bondRegistration} />}
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard className="mt-5 p-0">
        <div className="p-5 pb-0">
          <h3 className="font-display text-sm font-semibold text-muted-foreground">
            Transfer duty bracket breakdown
          </h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TRANSFER_DUTY_FALLBACK.map((b, i) => {
                const applied = !vatVendor && b === bracket;
                return (
                  <TableRow key={i} className={cn(applied && "bg-primary/5")}>
                    <TableCell className="money">{zarFmt(b.from / 100)}</TableCell>
                    <TableCell className="money">
                      {b.to ? zarFmt(b.to / 100) : "and above"}
                    </TableCell>
                    <TableCell className="money text-right">{b.rate}%</TableCell>
                    <TableCell className="text-right">
                      {applied ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Applied
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="money shrink-0 font-medium">{zarFmt(value)}</span>
    </div>
  );
}
