import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SliderInput } from "@/components/calculators/slider-input";
import { GlassCard } from "@/components/ui-kit";
import { Calculator } from "lucide-react";

const zarFmt = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function calculateBond(
  purchasePrice: number,
  deposit: number,
  interestRate: number,
  termYears: number,
) {
  const loanAmount = Math.max(0, purchasePrice - deposit);
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = termYears * 12;
  const monthlyPayment =
    monthlyRate === 0
      ? loanAmount / numPayments
      : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments));

  const totalRepayment = monthlyPayment * numPayments;
  const totalInterest = Math.max(0, totalRepayment - loanAmount);

  return { loanAmount, monthlyPayment, totalInterest, totalRepayment };
}

function calculateTransferCost(price: number) {
  let transferDuty = 0;
  if (price > 1210000) {
    if (price <= 1545000) transferDuty = (price - 1210000) * 0.03;
    else if (price <= 2125000) transferDuty = 10050 + (price - 1545000) * 0.06;
    else if (price <= 2880000) transferDuty = 44850 + (price - 2125000) * 0.08;
    else if (price <= 4000000) transferDuty = 105250 + (price - 2880000) * 0.11;
    else transferDuty = 228450 + (price - 4000000) * 0.13;
  }
  const conveyancingFee = Math.round(18000 + price * 0.005);
  const deedsFee = 1400;
  const total = Math.round(transferDuty + conveyancingFee + deedsFee);

  return { transferDuty, conveyancingFee, deedsFee, total };
}

export function FloatingCalculatorModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Bond State
  const [purchasePrice, setPurchasePrice] = useState(2500000);
  const [deposit, setDeposit] = useState(250000);
  const [interestRate, setInterestRate] = useState(11.75);
  const [termYears, setTermYears] = useState(20);

  // Transfer Cost State
  const [transferPrice, setTransferPrice] = useState(2500000);

  const bond = calculateBond(purchasePrice, deposit, interestRate, termYears);
  const transfer = calculateTransferCost(transferPrice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Calculator className="size-5 text-primary" />
            Quick Property Calculator
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="bond" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bond">Bond Repayment</TabsTrigger>
            <TabsTrigger value="transfer">Transfer Costs</TabsTrigger>
          </TabsList>

          <TabsContent value="bond" className="mt-4 space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <SliderInput
                  label="Purchase Price"
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  min={100000}
                  max={25000000}
                  step={50000}
                  format="zar"
                />
                <SliderInput
                  label="Deposit"
                  value={deposit}
                  onChange={setDeposit}
                  min={0}
                  max={purchasePrice}
                  step={25000}
                  format="zar"
                />
                <SliderInput
                  label="Interest Rate"
                  value={interestRate}
                  onChange={setInterestRate}
                  min={5}
                  max={20}
                  step={0.25}
                  format="pct"
                />
                <SliderInput
                  label="Loan Term"
                  value={termYears}
                  onChange={setTermYears}
                  min={5}
                  max={30}
                  step={1}
                  format="years"
                />
              </div>

              <div className="flex flex-col justify-between space-y-3">
                <GlassCard className="space-y-3 p-4">
                  <div>
                    <span className="text-xs uppercase text-muted-foreground">
                      Monthly Instalment
                    </span>
                    <p className="font-display text-2xl font-bold text-primary">
                      {zarFmt(bond.monthlyPayment)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Loan Amount:</span>
                      <p className="font-semibold">{zarFmt(bond.loanAmount)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Interest:</span>
                      <p className="font-semibold">{zarFmt(bond.totalInterest)}</p>
                    </div>
                  </div>
                </GlassCard>

                <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                  💡 Based on a prime interest rate of 11.75%. Final bond approval subject to bank
                  credit assessment.
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transfer" className="mt-4 space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <SliderInput
                  label="Property Purchase Price"
                  value={transferPrice}
                  onChange={setTransferPrice}
                  min={100000}
                  max={25000000}
                  step={50000}
                  format="zar"
                />
              </div>

              <GlassCard className="space-y-3 p-4">
                <div>
                  <span className="text-xs uppercase text-muted-foreground">
                    Estimated Total Costs
                  </span>
                  <p className="font-display text-2xl font-bold text-primary">
                    {zarFmt(transfer.total)}
                  </p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transfer Duty (SARS):</span>
                    <span className="font-semibold">{zarFmt(transfer.transferDuty)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conveyancing Fees:</span>
                    <span className="font-semibold">{zarFmt(transfer.conveyancingFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deeds Office Fees:</span>
                    <span className="font-semibold">{zarFmt(transfer.deedsFee)}</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
