import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard, KpiCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Landmark, ShieldCheck, ArrowUpRight, ArrowDownLeft, Plus, Loader2 } from "lucide-react";
import { zar, dateFmt } from "@/lib/format";
import { useTrustLedger, useRecordTrustTransaction } from "@/data/trust";
import type { TrustAccountType, TrustTransactionType } from "@/types";

export const Route = createFileRoute("/admin/trust")({
  component: AdminTrustPortal,
});

function AdminTrustPortal() {
  const { data: ledgerEntries = [], isLoading } = useTrustLedger();
  const recordTransactionMutation = useRecordTrustTransaction();

  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [accountType, setAccountType] = useState<TrustAccountType>("section_86_4_investment");
  const [transactionType, setTransactionType] = useState<TrustTransactionType>("deposit_inflow");
  const [amountRand, setAmountRand] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [statementDate, setStatementDate] = useState("");
  const [payerPayeeName, setPayerPayeeName] = useState("");
  const [clientPct, setClientPct] = useState("95");
  const [ppraPct, setPpraPct] = useState("5");

  const totalTrustBalanceCents = ledgerEntries.reduce((acc, item) => {
    if (item.transactionType === "deposit_inflow" || item.transactionType === "interest_credit") {
      return acc + item.amountCents;
    }
    return acc - item.amountCents;
  }, 0);

  const sec864Count = ledgerEntries.filter(
    (e) => e.accountType === "section_86_4_investment",
  ).length;

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountRand || isNaN(Number(amountRand)) || Number(amountRand) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!referenceNumber.trim() || !payerPayeeName.trim() || !statementDate) {
      toast.error("Please fill in all transaction reference details.");
      return;
    }

    try {
      await recordTransactionMutation.mutateAsync({
        accountType,
        transactionType,
        amountCents: Math.round(parseFloat(amountRand) * 100),
        referenceNumber: referenceNumber.trim(),
        bankStatementDate: statementDate,
        payerPayeeName: payerPayeeName.trim(),
        interestSplitClientPct: parseFloat(clientPct) || 95.0,
        interestSplitPpraPct: parseFloat(ppraPct) || 5.0,
      });

      toast.success("Trust transaction recorded cleanly!");
      setIsRecordOpen(false);
      setAmountRand("");
      setReferenceNumber("");
      setPayerPayeeName("");
      setStatementDate("");
    } catch (err: any) {
      toast.error(err.message || "Failed to record trust transaction.");
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Section 86 Trust Account Sub-Ledger"
        description="PPRA-compliant oversight, dual-principal authorization, and interest distribution under Section 86(2) and Section 86(4)."
        actions={
          <Button onClick={() => setIsRecordOpen(true)}>
            <Plus className="mr-2 size-4" /> Record Trust Transaction
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total Trust Balance"
            value={zar(totalTrustBalanceCents / 100)}
            trend={0}
            sub="Audited client funds"
            icon={Landmark}
            delay={0}
          />
          <KpiCard
            label="Sec 86(4) Investments"
            value={sec864Count}
            trend={0}
            sub="Active interest-bearing contracts"
            icon={ShieldCheck}
            delay={100}
          />
          <KpiCard
            label="PPRA Statutory Levy Rate"
            value="5.0%"
            trend={0}
            sub="Standard Section 86(4) split"
            icon={Landmark}
            delay={200}
          />
        </div>

        <GlassCard className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account Type</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Payer / Payee</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Approval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Loading trust sub-ledger...
                  </TableCell>
                </TableRow>
              ) : ledgerEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No trust account transactions recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                ledgerEntries.map((item) => {
                  const isInflow =
                    item.transactionType === "deposit_inflow" ||
                    item.transactionType === "interest_credit";
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{dateFmt(item.bankStatementDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.accountType === "section_86_4_investment"
                            ? "Sec 86(4) Invest"
                            : "Sec 86(2) General"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium">
                          {isInflow ? (
                            <ArrowDownLeft className="size-4 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="size-4 text-amber-500" />
                          )}
                          <span className="capitalize">
                            {item.transactionType.replace(/_/g, " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.payerPayeeName}</TableCell>
                      <TableCell className="font-mono text-xs">{item.referenceNumber}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${isInflow ? "text-emerald-400" : "text-amber-400"}`}
                      >
                        {isInflow ? "+" : "-"}
                        {zar(item.amountCents / 100)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.approvedByPrincipal ? "default" : "secondary"}>
                          {item.approvedByPrincipal ? "Principal Signed" : "Pending Approval"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </GlassCard>
      </div>

      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Trust Transaction</DialogTitle>
            <DialogDescription>
              Record a client deposit, refund, or Section 86(4) interest allocation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordTransaction} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="accType">Account Type</Label>
                <Select value={accountType} onValueChange={(val: any) => setAccountType(val)}>
                  <SelectTrigger id="accType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="section_86_4_investment">Sec 86(4) Investment</SelectItem>
                    <SelectItem value="section_86_2_general">Sec 86(2) General Trust</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="txType">Transaction Type</Label>
                <Select
                  value={transactionType}
                  onValueChange={(val: any) => setTransactionType(val)}
                >
                  <SelectTrigger id="txType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit_inflow">Deposit Inflow</SelectItem>
                    <SelectItem value="refund_outflow">Refund Outflow</SelectItem>
                    <SelectItem value="conveyancer_transfer">Conveyancer Transfer</SelectItem>
                    <SelectItem value="interest_credit">Interest Credit</SelectItem>
                    <SelectItem value="ppra_levy_deduction">PPRA Levy Split</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (ZAR) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g. 150000"
                value={amountRand}
                onChange={(e) => setAmountRand(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payer">Payer / Payee Name *</Label>
              <Input
                id="payer"
                placeholder="e.g. J. van der Merwe"
                value={payerPayeeName}
                onChange={(e) => setPayerPayeeName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ref">Reference Number *</Label>
                <Input
                  id="ref"
                  placeholder="e.g. DEP-98214"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Bank Statement Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {accountType === "section_86_4_investment" && (
              <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/30 p-3 border">
                <div className="space-y-1">
                  <Label htmlFor="clientPct" className="text-xs">
                    Client Interest %
                  </Label>
                  <Input
                    id="clientPct"
                    type="number"
                    value={clientPct}
                    onChange={(e) => setClientPct(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ppraPct" className="text-xs">
                    PPRA Levy %
                  </Label>
                  <Input
                    id="ppraPct"
                    type="number"
                    value={ppraPct}
                    onChange={(e) => setPpraPct(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="mt-6 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecordOpen(false)}
                disabled={recordTransactionMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={recordTransactionMutation.isPending}>
                {recordTransactionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Recording...
                  </>
                ) : (
                  "Record Transaction"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
