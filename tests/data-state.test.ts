import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMISSION_BPS,
  DEFAULT_SALE_PRICE_CENTS,
  VAT_RATE,
  grossCommission,
  netPayable,
  notificationTypes,
  transferDutyBrackets,
} from "@/data/state";

describe("data/state module configuration and helpers", () => {
  it("defines standard property management constants", () => {
    expect(VAT_RATE).toBe(15);
    expect(DEFAULT_SALE_PRICE_CENTS).toBe(250_000_000);
    expect(DEFAULT_COMMISSION_BPS).toBe(600);
  });

  it("calculates gross commission and net payable for a deal", () => {
    const mockDeal = {
      salePrice: 2_000_000,
      commissionBps: 500, // 5%
    };

    expect(grossCommission(mockDeal)).toBe(100_000);
    expect(netPayable(mockDeal)).toBe(100_000);
  });

  it("contains expected notification event types", () => {
    expect(notificationTypes).toContain("Suspensive condition deadline");
    expect(notificationTypes).toContain("Mandate expiry");
    expect(notificationTypes).toContain("Commission released");
  });

  it("contains valid ordered SARS transfer duty brackets", () => {
    expect(transferDutyBrackets.length).toBeGreaterThan(0);
    expect(transferDutyBrackets[0].from).toBe(0);
    expect(transferDutyBrackets[0].to).toBe(121_000_000);
    expect(transferDutyBrackets[0].rate).toBe(0);

    for (let i = 1; i < transferDutyBrackets.length; i++) {
      expect(transferDutyBrackets[i].from).toBe(transferDutyBrackets[i - 1].to);
      expect(transferDutyBrackets[i].rate).toBeGreaterThan(transferDutyBrackets[i - 1].rate);
    }
  });
});
