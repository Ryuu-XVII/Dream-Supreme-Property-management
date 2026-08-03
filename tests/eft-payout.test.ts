import { describe, it, expect } from "vitest";
import { generateEftBatchCsv } from "../src/services/eftPayoutService";

describe("ACH / EFT Batch Agent Commission Payout File Generator (Pillar 5)", () => {
  it("exports valid South African ACB / EFT CSV batch payout file", () => {
    const payouts = [
      {
        agentName: "Adnaan Ryuu",
        bankName: "First National Bank",
        accountNumber: "62899001122",
        branchCode: "250655",
        amountCents: 5100000, // R51,000.00
        reference: "COMM-DEAL-8899",
      },
    ];

    const csv = generateEftBatchCsv("BATCH-202608-01", payouts);

    expect(csv).toContain("BATCH_REF,AGENT_NAME,BANK,ACCOUNT_NO");
    expect(csv).toContain('BATCH-202608-01,"Adnaan Ryuu"');
    expect(csv).toContain("5100000");
  });
});
