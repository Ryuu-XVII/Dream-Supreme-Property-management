import { describe, it, expect } from "vitest";
import { formatGeneralLedgerExportPayload } from "../src/services/accountingSyncService";

describe("Two-Way General Ledger Sync Gateway (Pillar 6)", () => {
  it("formats Xero/QuickBooks GL sync payload cleanly with total cent validation", () => {
    const items = [
      {
        transactionId: "tx-1001",
        date: "2026-08-01",
        accountCode: "200-TRUST",
        description: "Tenant Deposit Received",
        amountCents: 1500000,
        taxCode: "NONE",
      },
    ];

    const payload = formatGeneralLedgerExportPayload("xero", items);

    expect(payload.platform).toBe("xero");
    expect(payload.total_cents).toBe(1500000);
    expect(payload.item_count).toBe(1);
  });
});
