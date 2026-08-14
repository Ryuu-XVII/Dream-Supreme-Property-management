import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Papa from "papaparse";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar } from "@/lib/format";
import { useRecordTrustTransaction } from "@/data/trust";
import { Upload, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  matchedLeaseId: string | null;
  matchedLeaseName: string | null;
  status: "pending" | "reconciled" | "failed";
}

export function ReconciliationContent() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const recordTransaction = useRecordTrustTransaction();

  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch active leases with payment references
  const leasesQuery = useQuery({
    queryKey: ["leases-for-recon", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease")
        .select(
          `
          id,
          payment_reference,
          tenant_name,
          rent_amount_cents,
          lease_invoice (
            id, status, amount_cents, due_on
          )
        `,
        )
        .eq("agency_id", account!.agencyId)
        .eq("status", "active");

      if (error) throw error;
      return data || [];
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: ParsedTransaction[] = results.data.map((row: any, i) => {
          const safeRow: Record<string, string> = {};
          for (const key in row) {
            safeRow[key.trim().toLowerCase()] = row[key];
          }

          const rawDate = safeRow["date"] || safeRow["transaction date"] || "";
          const desc = safeRow["description"] || safeRow["reference"] || "";
          const amtStr = safeRow["amount"] || "0";
          const amount = parseFloat(amtStr.replace(/,/g, ""));

          return {
            id: `tx-${i}`,
            date: rawDate,
            description: desc,
            amount,
            matchedLeaseId: null,
            matchedLeaseName: null,
            status: "pending",
          };
        });

        const deposits = parsed.filter((t) => t.amount > 0);

        if (leasesQuery.data) {
          deposits.forEach((tx) => {
            const descLower = tx.description.toLowerCase();
            const matchedLease = leasesQuery.data.find(
              (l) =>
                (l.payment_reference && descLower.includes(l.payment_reference.toLowerCase())) ||
                (l.tenant_name && descLower.includes(l.tenant_name.toLowerCase())),
            );

            if (matchedLease) {
              tx.matchedLeaseId = matchedLease.id;
              tx.matchedLeaseName = matchedLease.tenant_name;
            }
          });
        }

        setTransactions(deposits);
      },
      error: (error: any) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const handleReconcileAll = async () => {
    const matchedTxs = transactions.filter((t) => t.matchedLeaseId && t.status === "pending");
    if (matchedTxs.length === 0) {
      toast.error("No matched transactions to reconcile.");
      return;
    }

    setIsProcessing(true);
    try {
      await reconcileMatchedTransactions(matchedTxs);
    } finally {
      setIsProcessing(false);
    }
  };

  const reconcileMatchedTransactions = async (matchedTxs: ParsedTransaction[]) => {
    // Fetch every outstanding invoice for the matched leases in one batched
    // query instead of one query per transaction, then deterministically hand
    // out invoices in due-on order per lease (mirrors the old per-tx
    // "earliest outstanding invoice" lookup for leases with multiple matched
    // deposits in the same batch, without a network round trip per tx).
    const leaseIds = [...new Set(matchedTxs.map((t) => t.matchedLeaseId!))];
    const { data: outstandingInvoices } = await supabase
      .from("lease_invoice")
      .select("*")
      .in("lease_id", leaseIds)
      .in("status", ["draft", "issued", "overdue"])
      .order("due_on", { ascending: true });

    const invoiceQueueByLease = new Map<string, any[]>();
    for (const inv of outstandingInvoices ?? []) {
      const queue = invoiceQueueByLease.get(inv.lease_id) ?? [];
      queue.push(inv);
      invoiceQueueByLease.set(inv.lease_id, queue);
    }

    const matchedInvoiceByTxId = new Map<string, any>();
    for (const tx of matchedTxs) {
      const inv = invoiceQueueByLease.get(tx.matchedLeaseId!)?.shift();
      if (inv) matchedInvoiceByTxId.set(tx.id, inv);
    }

    const results = await Promise.allSettled(
      matchedTxs.map((tx) =>
        recordTransaction.mutateAsync({
          leaseId: tx.matchedLeaseId!,
          accountType: "section_86_2_general",
          transactionType: "deposit_inflow",
          amountCents: Math.round(tx.amount * 100),
          referenceNumber: tx.description.substring(0, 50),
          bankStatementDate: tx.date || new Date().toISOString().split("T")[0],
          payerPayeeName: tx.matchedLeaseName || "Unknown Tenant",
        }),
      ),
    );

    const paidOn = new Date().toISOString().split("T")[0];
    const invoiceUpdates: { id: string; status: string; paid_cents: number; paid_on: string }[] =
      [];
    let successCount = 0;

    results.forEach((result, i) => {
      const tx = matchedTxs[i];
      if (result.status === "fulfilled") {
        tx.status = "reconciled";
        successCount++;
        const inv = matchedInvoiceByTxId.get(tx.id);
        if (inv) {
          invoiceUpdates.push({
            id: inv.id,
            status: "paid",
            paid_cents: inv.amount_cents,
            paid_on: paidOn,
          });
        }
      } else {
        console.error("Failed to reconcile tx", tx, result.reason);
        tx.status = "failed";
      }
    });

    if (invoiceUpdates.length > 0) {
      const { error: invoiceError } = await supabase.from("lease_invoice").upsert(invoiceUpdates);
      if (invoiceError) {
        toast.error(`Some invoices could not be marked paid: ${invoiceError.message}`);
      }
    }

    setTransactions([...transactions]);
    queryClient.invalidateQueries({ queryKey: ["leases-for-recon"] });
    toast.success(`Successfully reconciled ${successCount} transactions.`);
  };

  return (
    <>
      <AdminPageHeader
        title="Bank Feed Reconciliation"
        description="Upload bank statement CSV files to automatically match and reconcile tenant payments against the Trust Ledger."
        actions={
          <div className="flex items-center gap-2">
            <Input type="file" accept=".csv" onChange={handleFileUpload} className="w-auto" />
          </div>
        }
      />

      <GlassCard className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Imported Transactions</h3>
          <Button onClick={handleReconcileAll} disabled={isProcessing || transactions.length === 0}>
            {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
            Reconcile Matched
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Match Status</TableHead>
              <TableHead>Recon Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <Upload className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  No transactions loaded. Please upload a CSV bank statement.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{tx.date}</TableCell>
                  <TableCell className="font-medium text-sm">{tx.description}</TableCell>
                  <TableCell className="text-emerald-500 font-medium">+{zar(tx.amount)}</TableCell>
                  <TableCell>
                    {tx.matchedLeaseName ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                        {tx.matchedLeaseName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/20">
                        Unmatched
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {tx.status === "reconciled" ? (
                      <div className="flex items-center text-emerald-500 text-sm">
                        <CheckCircle2 className="size-4 mr-1" /> Reconciled
                      </div>
                    ) : tx.status === "failed" ? (
                      <span className="text-red-500 text-sm">Failed</span>
                    ) : (
                      <div className="flex items-center text-muted-foreground text-sm">
                        <CircleDashed className="size-4 mr-1" /> Pending
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </>
  );
}
