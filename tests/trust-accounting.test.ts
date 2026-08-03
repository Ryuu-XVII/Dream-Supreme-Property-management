import { describe, expect, it } from "vitest";
import type { TrustLedgerEntry } from "@/types";

function calculateTrustInterestSplit(
  interestAmountCents: number,
  clientSharePct = 95,
  ppraSharePct = 5,
) {
  if (interestAmountCents <= 0) return { clientCents: 0, ppraCents: 0 };
  const clientCents = Math.round((interestAmountCents * clientSharePct) / 100);
  const ppraCents = interestAmountCents - clientCents;
  return { clientCents, ppraCents };
}

function validateTrustLedgerBalance(entries: Partial<TrustLedgerEntry>[]): number {
  return entries.reduce((acc, entry) => {
    switch (entry.transactionType) {
      case "deposit_inflow":
      case "interest_credit":
        return acc + (entry.amountCents || 0);
      case "refund_outflow":
      case "conveyancer_transfer":
      case "ppra_levy_deduction":
        return acc - (entry.amountCents || 0);
      default:
        return acc;
    }
  }, 0);
}

describe("trust accounting ledger calculations", () => {
  it("calculates statutory Section 86(4) interest split accurately", () => {
    // R10,000 interest credit -> 95% client (R9,500), 5% PPRA statutory levy (R500)
    const { clientCents, ppraCents } = calculateTrustInterestSplit(1_000_000, 95, 5);
    expect(clientCents).toBe(950_000);
    expect(ppraCents).toBe(50_000);
  });

  it("handles zero or negative interest credits", () => {
    const res = calculateTrustInterestSplit(0);
    expect(res.clientCents).toBe(0);
    expect(res.ppraCents).toBe(0);
  });

  it("calculates net trust account ledger balance across transaction types", () => {
    const entries: Partial<TrustLedgerEntry>[] = [
      { transactionType: "deposit_inflow", amountCents: 50_000_000 }, // +R500k deposit
      { transactionType: "interest_credit", amountCents: 1_000_000 }, // +R10k interest
      { transactionType: "ppra_levy_deduction", amountCents: 50_000 }, // -R500 PPRA levy
      { transactionType: "conveyancer_transfer", amountCents: 50_000_000 }, // -R500k to conveyancer
    ];

    const netBalance = validateTrustLedgerBalance(entries);
    expect(netBalance).toBe(950_000); // Remaining R9,500 client interest
  });
});
