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
  /**
   * How the lease was identified. Only "reference" is auto-reconciled: a
   * payment reference is issued by the agency and is unique, whereas a tenant
   * name appearing in free-text bank narration is a guess. Misallocating money
   * in a section 86 trust account is a regulatory problem, not a cosmetic one.
   */
  matchBasis: "reference" | "name" | "ambiguous" | null;
  status: "pending" | "reconciled" | "failed" | "skipped";
  note?: string;
}

export function ReconciliationContent() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const recordTransaction = useRecordTrustTransaction();

  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Only payment-reference matches can be posted automatically — see
  // handleReconcileAll — so this is what the button actually acts on.
  const readyCount = transactions.filter(
    (t) => t.status === "pending" && t.matchBasis === "reference" && t.matchedLeaseId,
  ).length;

  // Fetch active leases with payment references
  const leasesQuery = useQuery({
    queryKey: ["leases-for-recon", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease")
        // Column names matter here: this query previously asked for
        // `tenant_name`, `rent_amount_cents` and `lease_invoice.amount_cents`,
        // none of which exist, so it returned HTTP 400 every time and nothing
        // ever matched. The real columns are the tenant party's full_name,
        // monthly_rent_cents and total_cents.
        .select(
          `
          id,
          payment_reference,
          monthly_rent_cents,
          tenant:tenant_party_id ( full_name ),
          lease_invoice ( id, status, total_cents, paid_cents, due_on )
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
            matchBasis: null,
            status: "pending",
          };
        });

        const deposits = parsed.filter((t) => t.amount > 0);

        if (leasesQuery.data) {
          const leases = leasesQuery.data as any[];
          deposits.forEach((tx) => {
            const descLower = tx.description.toLowerCase();

            // A payment reference is issued by the agency and unique, so a hit
            // is trustworthy on its own.
            const byReference = leases.filter(
              (l) => l.payment_reference && descLower.includes(l.payment_reference.toLowerCase()),
            );

            // A tenant name inside free-text bank narration is a guess: common
            // surnames collide, and the previous code silently took the first
            // hit. Collect every candidate so an ambiguous one can be held
            // back rather than allocated to whichever lease sorted first.
            const byName = leases.filter((l) => {
              const name: string = l.tenant?.full_name ?? "";
              return name.length >= 4 && descLower.includes(name.toLowerCase());
            });

            const nameOf = (lease: any) => lease.tenant?.full_name ?? "Unknown tenant";

            if (byReference.length === 1) {
              tx.matchedLeaseId = byReference[0].id;
              tx.matchedLeaseName = nameOf(byReference[0]);
              tx.matchBasis = "reference";
            } else if (byReference.length > 1) {
              tx.matchBasis = "ambiguous";
              tx.note = `${byReference.length} leases share this payment reference`;
            } else if (byName.length === 1) {
              tx.matchedLeaseId = byName[0].id;
              tx.matchedLeaseName = nameOf(byName[0]);
              tx.matchBasis = "name";
              tx.note = "Matched on tenant name — confirm before reconciling";
            } else if (byName.length > 1) {
              tx.matchBasis = "ambiguous";
              tx.note = `Matches ${byName.length} tenants by name`;
            }
          });
        }

        // A bank statement re-uploaded by mistake would otherwise be recorded
        // twice. Identical date+amount+description rows inside one file are
        // usually genuine repeats, so flag rather than drop them.
        const seen = new Map<string, number>();
        deposits.forEach((tx) => {
          const key = `${tx.date}|${tx.amount}|${tx.description}`;
          const count = (seen.get(key) ?? 0) + 1;
          seen.set(key, count);
          if (count > 1) {
            tx.note = `Duplicate of an earlier row in this file (#${count})`;
          }
        });

        setTransactions(deposits);
      },
      error: (error: any) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const handleReconcileAll = async () => {
    // Reference matches only. A tenant-name match is a guess at whose money
    // this is, and this writes to a section 86 trust account — so those are
    // left for a human to confirm rather than posted automatically.
    const matchedTxs = transactions.filter(
      (t) => t.matchedLeaseId && t.status === "pending" && t.matchBasis === "reference",
    );
    const heldBack = transactions.filter(
      (t) => t.status === "pending" && t.matchBasis !== "reference" && t.matchBasis !== null,
    ).length;

    if (matchedTxs.length === 0) {
      toast.error(
        heldBack > 0
          ? "No transactions matched on payment reference. Name-only matches must be confirmed manually."
          : "No matched transactions to reconcile.",
      );
      return;
    }

    if (heldBack > 0) {
      toast.info(`${heldBack} transaction(s) held back for manual review.`);
    }

    setIsProcessing(true);
    try {
      await reconcileMatchedTransactions(matchedTxs);
    } finally {
      setIsProcessing(false);
    }
  };

  const reconcileMatchedTransactions = async (matchedTxs: ParsedTransaction[]) => {
    // Outstanding invoices per lease, oldest first, so a deposit settles the
    // longest-standing debt first.
    const leaseIds = [...new Set(matchedTxs.map((t) => t.matchedLeaseId!))];
    const { data: outstandingInvoices } = await supabase
      .from("lease_invoice")
      .select("id, lease_id, total_cents, paid_cents, status, due_on")
      .in("lease_id", leaseIds)
      .in("status", ["draft", "issued", "overdue"])
      .order("due_on", { ascending: true });

    const invoiceQueueByLease = new Map<string, any[]>();
    for (const inv of outstandingInvoices ?? []) {
      const queue = invoiceQueueByLease.get(inv.lease_id) ?? [];
      queue.push({ ...inv });
      invoiceQueueByLease.set(inv.lease_id, queue);
    }

    // Allocate each deposit across that lease's outstanding invoices by the
    // amount actually received. The previous version marked the first invoice
    // `paid` for its full value regardless of the deposit, so a R500 payment
    // closed a R10 000 invoice and the shortfall vanished.
    const invoiceUpdates = new Map<string, { paid_cents: number; status: string }>();
    const allocationByTxId = new Map<string, number>();

    for (const tx of matchedTxs) {
      let remaining = Math.round(tx.amount * 100);
      const queue = invoiceQueueByLease.get(tx.matchedLeaseId!) ?? [];

      while (remaining > 0 && queue.length > 0) {
        const invoice = queue[0];
        const owed = invoice.total_cents - invoice.paid_cents;
        if (owed <= 0) {
          queue.shift();
          continue;
        }
        const applied = Math.min(owed, remaining);
        invoice.paid_cents += applied;
        remaining -= applied;

        invoiceUpdates.set(invoice.id, {
          paid_cents: invoice.paid_cents,
          // Only fully settled invoices become `paid`; a part payment stays
          // outstanding so it still shows up as owing.
          status: invoice.paid_cents >= invoice.total_cents ? "paid" : invoice.status,
        });

        if (invoice.paid_cents >= invoice.total_cents) queue.shift();
      }

      // Anything left over is still banked to the trust account — it is the
      // tenant's money either way — it simply is not allocated to an invoice.
      allocationByTxId.set(tx.id, Math.round(tx.amount * 100) - remaining);
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
    let successCount = 0;
    const settledInvoiceIds = new Set<string>();

    results.forEach((result, i) => {
      const tx = matchedTxs[i];
      if (result.status === "fulfilled") {
        tx.status = "reconciled";
        successCount++;
        const allocated = allocationByTxId.get(tx.id) ?? 0;
        const deposited = Math.round(tx.amount * 100);
        if (allocated < deposited) {
          tx.note = `${zar(deposited - allocated, { decimals: false })} not allocated to an invoice`;
        }
      } else {
        console.error("Failed to reconcile tx", tx, result.reason);
        tx.status = "failed";
        // The ledger entry failed, so its invoice allocation must not be
        // written either.
        for (const invoice of invoiceQueueByLease.get(tx.matchedLeaseId!) ?? []) {
          settledInvoiceIds.add(invoice.id);
        }
      }
    });

    // Update invoices individually: an upsert of partial columns fails the
    // NOT NULL constraints on lease_id/period_start/total_cents, which is why
    // the previous version could never mark anything paid.
    const failedLeaseIds = new Set(
      matchedTxs.filter((t) => t.status === "failed").map((t) => t.matchedLeaseId),
    );
    let invoiceErrors = 0;
    for (const [invoiceId, update] of invoiceUpdates) {
      const invoice = (outstandingInvoices ?? []).find((row: any) => row.id === invoiceId);
      if (invoice && failedLeaseIds.has(invoice.lease_id)) continue;

      const { error } = await supabase
        .from("lease_invoice")
        .update({
          paid_cents: update.paid_cents,
          status: update.status,
          paid_on: update.status === "paid" ? paidOn : null,
        })
        .eq("id", invoiceId);
      if (error) invoiceErrors++;
    }

    if (invoiceErrors > 0) {
      toast.error(`${invoiceErrors} invoice(s) could not be updated.`);
    }

    setTransactions([...transactions]);
    void queryClient.invalidateQueries({ queryKey: ["leases-for-recon"] });
    toast.success(`Reconciled ${successCount} of ${matchedTxs.length} transactions.`);
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
          <Button
            onClick={handleReconcileAll}
            disabled={isProcessing || readyCount === 0}
            // Say why it is unavailable instead of just greying out: the
            // reasons are different (nothing uploaded / nothing matched / only
            // name matches, which need a human) and the user cannot tell them
            // apart from a disabled button alone.
            title={
              transactions.length === 0
                ? "Upload a bank statement CSV first"
                : readyCount === 0
                  ? "No transactions matched on payment reference. Name-only and ambiguous matches must be confirmed manually."
                  : `Reconcile ${readyCount} transaction(s) matched on payment reference`
            }
          >
            {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {readyCount > 0 ? `Reconcile ${readyCount} Matched` : "Reconcile Matched"}
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
                    <div className="space-y-1">
                      {tx.matchedLeaseName ? (
                        <Badge
                          className={
                            tx.matchBasis === "reference"
                              ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20"
                          }
                        >
                          {tx.matchedLeaseName}
                          {tx.matchBasis === "reference" ? " · ref" : " · name"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/20">
                          {tx.matchBasis === "ambiguous" ? "Ambiguous" : "Unmatched"}
                        </Badge>
                      )}
                      {tx.note && (
                        <p className="text-[11px] leading-snug text-muted-foreground">{tx.note}</p>
                      )}
                    </div>
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
