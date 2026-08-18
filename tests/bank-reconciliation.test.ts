import { describe, expect, it } from "vitest";
import { allocateDepositsToInvoices, type OutstandingInvoice } from "@/lib/bank-reconciliation";

const R = (rands: number) => Math.round(rands * 100);

function invoice(overrides: Partial<OutstandingInvoice> = {}): OutstandingInvoice {
  return {
    id: "inv-1",
    lease_id: "lease-1",
    total_cents: R(10000),
    paid_cents: 0,
    status: "issued",
    due_on: "2026-01-01",
    ...overrides,
  };
}

describe("allocating bank deposits to lease invoices", () => {
  it("leaves an invoice outstanding when only part of it is paid", () => {
    // The screen used to mark this invoice paid in full for a R500 deposit,
    // so the R9 500 shortfall silently disappeared.
    const { invoiceUpdates } = allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(500) }],
      [invoice()],
    );

    expect(invoiceUpdates.get("inv-1")).toEqual({
      paid_cents: R(500),
      status: "issued",
    });
  });

  it("marks an invoice paid only once it is fully covered", () => {
    const { invoiceUpdates } = allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(10000) }],
      [invoice()],
    );

    expect(invoiceUpdates.get("inv-1")).toEqual({
      paid_cents: R(10000),
      status: "paid",
    });
  });

  it("settles the oldest invoice first and spills the remainder onto the next", () => {
    const { invoiceUpdates } = allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(15000) }],
      [
        invoice({ id: "older", status: "overdue", due_on: "2026-01-01" }),
        invoice({ id: "newer", status: "issued", due_on: "2026-02-01" }),
      ],
    );

    expect(invoiceUpdates.get("older")).toEqual({ paid_cents: R(10000), status: "paid" });
    expect(invoiceUpdates.get("newer")).toEqual({ paid_cents: R(5000), status: "issued" });
  });

  it("reports an overpayment as unallocated rather than inventing an invoice", () => {
    const { invoiceUpdates, allocatedByDepositId } = allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(12000) }],
      [invoice()],
    );

    expect(invoiceUpdates.get("inv-1")).toEqual({ paid_cents: R(10000), status: "paid" });
    // Only what was owed is allocated; the surplus is still banked but is
    // reported so the operator can see it.
    expect(allocatedByDepositId.get("tx-1")).toBe(R(10000));
    expect(R(12000) - allocatedByDepositId.get("tx-1")!).toBe(R(2000));
  });

  it("tops up an invoice that was already part paid", () => {
    const { invoiceUpdates } = allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(3000) }],
      [invoice({ paid_cents: R(7000) })],
    );

    expect(invoiceUpdates.get("inv-1")).toEqual({ paid_cents: R(10000), status: "paid" });
  });

  it("keeps each lease's invoices separate", () => {
    const { invoiceUpdates } = allocateDepositsToInvoices(
      [
        { id: "tx-1", leaseId: "lease-1", amountCents: R(10000) },
        { id: "tx-2", leaseId: "lease-2", amountCents: R(2000) },
      ],
      [
        invoice({ id: "inv-a", lease_id: "lease-1" }),
        invoice({ id: "inv-b", lease_id: "lease-2" }),
      ],
    );

    expect(invoiceUpdates.get("inv-a")).toEqual({ paid_cents: R(10000), status: "paid" });
    expect(invoiceUpdates.get("inv-b")).toEqual({ paid_cents: R(2000), status: "issued" });
  });

  it("allocates nothing when the lease has no outstanding invoices", () => {
    const { invoiceUpdates, allocatedByDepositId } = allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(4000) }],
      [],
    );

    expect(invoiceUpdates.size).toBe(0);
    expect(allocatedByDepositId.get("tx-1")).toBe(0);
  });

  it("does not mutate the invoices it was given", () => {
    const original = invoice();
    allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(10000) }],
      [original],
    );

    expect(original.paid_cents).toBe(0);
    expect(original.status).toBe("issued");
  });

  it("skips an invoice that is already settled and pays the next one", () => {
    const { invoiceUpdates } = allocateDepositsToInvoices(
      [{ id: "tx-1", leaseId: "lease-1", amountCents: R(10000) }],
      [
        invoice({ id: "settled", paid_cents: R(10000) }),
        invoice({ id: "open", due_on: "2026-02-01" }),
      ],
    );

    expect(invoiceUpdates.has("settled")).toBe(false);
    expect(invoiceUpdates.get("open")).toEqual({ paid_cents: R(10000), status: "paid" });
  });
});
