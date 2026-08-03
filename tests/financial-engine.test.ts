import { describe, it, expect } from "vitest";
import { calculateTieredCommissionPreview } from "../src/services/financialEngineService";

describe("Financial Engine & Multi-Tiered Commission Management (Module 3)", () => {
  it("calculates exact gross commission, SARS 15% VAT, and agent/agency splits", () => {
    const purchasePriceCents = 200000000; // R2,000,000.00
    const result = calculateTieredCommissionPreview(
      purchasePriceCents,
      5.0, // 5% gross commission = R100,000.00
      60.0, // 60% agent split
      0.15, // 15% VAT
    );

    expect(result.grossCommissionCents).toBe(10000000); // R100,000.00
    expect(result.vatCents).toBe(1500000); // R15,000.00 VAT
    expect(result.netCommissionCents).toBe(8500000); // R85,000.00 Net
    expect(result.agentPayoutCents).toBe(5100000); // R51,000.00 Agent
    expect(result.agencyRetentionCents).toBe(3400000); // R34,000.00 Agency
  });

  it("reconciles agent payout + agency retention to exactly equal net commission with zero penny loss", () => {
    const purchasePriceCents = 333333333; // R3,333,333.33
    const result = calculateTieredCommissionPreview(purchasePriceCents, 5.5, 67.5, 0.15);

    expect(result.agentPayoutCents + result.agencyRetentionCents).toBe(result.netCommissionCents);
  });
});
