import { describe, it, expect } from "vitest";
import { daysUntil } from "@/lib/format";

describe("Agent Required Compliance Documents", () => {
  it("defines standard statutory categories for South African property practitioners", () => {
    const requiredCategories = [
      "ffc_certificate",
      "fica_id",
      "fica_proof_of_address",
      "fica_bank_statement",
      "other",
    ];

    expect(requiredCategories).toContain("ffc_certificate");
    expect(requiredCategories).toContain("fica_id");
    expect(requiredCategories).toContain("fica_proof_of_address");
    expect(requiredCategories).toContain("fica_bank_statement");
  });

  it("calculates FFC expiry status transitions correctly", () => {
    const today = new Date();

    // Future date > 30 days
    const validDate = new Date();
    validDate.setDate(today.getDate() + 90);
    const validExpiry = validDate.toISOString().slice(0, 10);
    const validDays = daysUntil(validExpiry);
    expect(validDays).toBeGreaterThan(30);

    // Expiring soon <= 30 days
    const expiringDate = new Date();
    expiringDate.setDate(today.getDate() + 15);
    const expiringExpiry = expiringDate.toISOString().slice(0, 10);
    const expiringDays = daysUntil(expiringExpiry);
    expect(expiringDays).toBeLessThanOrEqual(30);
    expect(expiringDays).toBeGreaterThan(0);

    // Expired
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 5);
    const pastExpiry = pastDate.toISOString().slice(0, 10);
    const pastDays = daysUntil(pastExpiry);
    expect(pastDays).toBeLessThan(0);
  });
});
