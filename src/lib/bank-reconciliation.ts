// Allocation of bank deposits against outstanding lease invoices.
//
// Extracted from the reconciliation screen so it can be tested directly: this
// decides how much of a tenant's payment settles which invoice, and it writes
// to a section 86 trust account. The screen previously marked an invoice paid
// for its full value regardless of the deposit, so a R500 payment closed a
// R10 000 invoice and the shortfall disappeared.

export interface OutstandingInvoice {
  id: string;
  lease_id: string;
  total_cents: number;
  paid_cents: number;
  status: string;
  due_on?: string;
}

export interface DepositToAllocate {
  id: string;
  leaseId: string;
  /** Deposit value in cents. */
  amountCents: number;
}

export interface InvoiceAllocation {
  paid_cents: number;
  status: string;
}

export interface AllocationResult {
  /** Invoice id → the values to persist. */
  invoiceUpdates: Map<string, InvoiceAllocation>;
  /** Deposit id → how many cents were matched to an invoice. */
  allocatedByDepositId: Map<string, number>;
}

/**
 * Applies each deposit to that lease's outstanding invoices, oldest first.
 *
 * An invoice only becomes `paid` once it is fully covered — a part payment
 * keeps its existing status so it still reads as owing. Anything left over
 * after every invoice is settled is reported through `allocatedByDepositId`
 * (allocated < deposited) rather than being written anywhere, because the
 * money is still the tenant's even though no invoice claims it.
 *
 * Invoices are expected in due date order per lease.
 */
export function allocateDepositsToInvoices(
  deposits: DepositToAllocate[],
  invoices: OutstandingInvoice[],
): AllocationResult {
  const queueByLease = new Map<string, OutstandingInvoice[]>();
  for (const invoice of invoices) {
    const queue = queueByLease.get(invoice.lease_id) ?? [];
    // Copied so callers keep their own objects unmutated.
    queue.push({ ...invoice });
    queueByLease.set(invoice.lease_id, queue);
  }

  const invoiceUpdates = new Map<string, InvoiceAllocation>();
  const allocatedByDepositId = new Map<string, number>();

  for (const deposit of deposits) {
    let remaining = deposit.amountCents;
    const queue = queueByLease.get(deposit.leaseId) ?? [];

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
        status: invoice.paid_cents >= invoice.total_cents ? "paid" : invoice.status,
      });

      if (invoice.paid_cents >= invoice.total_cents) queue.shift();
    }

    allocatedByDepositId.set(deposit.id, deposit.amountCents - remaining);
  }

  return { invoiceUpdates, allocatedByDepositId };
}
