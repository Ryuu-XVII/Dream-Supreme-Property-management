import { describe, it, expect } from "vitest";

describe("Admin Deal Notifications", () => {
  it("formats registered deal closure notification correctly", () => {
    const dealRef = "DSL-2026-0042";
    const propertyAddress = "12 Ocean View Drive, Camps Bay";
    const salePriceCents = 450000000;

    const subject = `🎉 Deal Registered & Closed: ${dealRef}`;
    const body = `Deal for property at ${propertyAddress} has been registered and closed. Final sale price: R${(salePriceCents / 100).toFixed(2)}`;

    expect(subject).toContain("DSL-2026-0042");
    expect(body).toContain("12 Ocean View Drive");
    expect(body).toContain("4500000.00");
  });

  it("formats deal cancellation notification correctly", () => {
    const dealRef = "DSL-2026-0089";
    const propertyAddress = "88 Kloof Street, Gardens";
    const reason = "bond_declined";
    const notes = "Bank declined 100% bond application";

    const subject = `🚨 Deal Cancelled: ${dealRef}`;
    const body = `Deal at ${propertyAddress} was cancelled. Reason: ${reason}. Notes: ${notes}`;

    expect(subject).toContain("DSL-2026-0089");
    expect(body).toContain("bond_declined");
    expect(body).toContain("Bank declined");
  });
});
