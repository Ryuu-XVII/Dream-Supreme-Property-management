import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMISSION_BPS,
  DEFAULT_SALE_PRICE_CENTS,
  DEFAULT_VAT_PERCENT,
  TRANSFER_DUTY_FALLBACK,
} from "@/lib/financial-config";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notification-events";

describe("financial and notification configuration", () => {
  it("defines standard property management constants", () => {
    expect(DEFAULT_VAT_PERCENT).toBe(15);
    expect(DEFAULT_SALE_PRICE_CENTS).toBe(250_000_000);
    expect(DEFAULT_COMMISSION_BPS).toBe(600);
  });

  it("contains expected notification event types", () => {
    expect(NOTIFICATION_EVENT_TYPES).toContain("Condition due");
    expect(NOTIFICATION_EVENT_TYPES).toContain("Mandate expiring");
    expect(NOTIFICATION_EVENT_TYPES).toContain("Commission issued");
  });

  it("contains valid ordered SARS transfer duty brackets", () => {
    expect(TRANSFER_DUTY_FALLBACK.length).toBeGreaterThan(0);
    expect(TRANSFER_DUTY_FALLBACK[0].from).toBe(0);
    expect(TRANSFER_DUTY_FALLBACK[0].to).toBe(121_000_000);
    expect(TRANSFER_DUTY_FALLBACK[0].rate).toBe(0);

    for (let i = 1; i < TRANSFER_DUTY_FALLBACK.length; i++) {
      expect(TRANSFER_DUTY_FALLBACK[i].from).toBe(TRANSFER_DUTY_FALLBACK[i - 1].to);
      expect(TRANSFER_DUTY_FALLBACK[i].rate).toBeGreaterThan(TRANSFER_DUTY_FALLBACK[i - 1].rate);
    }
  });
});
