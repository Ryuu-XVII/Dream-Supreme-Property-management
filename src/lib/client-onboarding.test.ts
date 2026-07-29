import { describe, expect, it } from "vitest";
import { createInitialClientCapture, validateClientCapture } from "./client-onboarding";

describe("client onboarding validation", () => {
  it("allows minimal contact capture after privacy notice delivery", () => {
    const form = {
      ...createInitialClientCapture(),
      name: "Nomsa Dlamini",
      mobile: "+27 82 123 4567",
      privacyNoticeDelivered: true,
    };
    expect(validateClientCapture(form)).toEqual([]);
  });

  it("does not treat ordinary client capture as marketing consent", () => {
    const form = {
      ...createInitialClientCapture(),
      name: "Nomsa Dlamini",
      mobile: "+27 82 123 4567",
      privacyNoticeDelivered: true,
      directMarketingConsent: true,
    };
    expect(validateClientCapture(form)).toContain(
      "Select at least one consented direct-marketing channel.",
    );
  });

  it("requires identity, address, and screening for FICA onboarding", () => {
    const form = {
      ...createInitialClientCapture(),
      name: "Nomsa Dlamini",
      mobile: "+27 82 123 4567",
      privacyNoticeDelivered: true,
      startFica: true,
    };
    const errors = validateClientCapture(form);
    expect(errors).toContain("ID, passport, trust, or registration number is required.");
    expect(errors).toContain(
      "Targeted-financial-sanctions screening must be completed at client take-on.",
    );
  });

  it("requires authority and beneficial owners for an entity", () => {
    const form = {
      ...createInitialClientCapture(),
      name: "Example Property Trust",
      roles: ["landlord" as const],
      entityType: "trust" as const,
      email: "admin@example.co.za",
      preferredContactChannel: "email" as const,
      privacyNoticeDelivered: true,
      startFica: true,
      idNumber: "IT1234/2020",
      addressLine: "1 Main Road",
      city: "Johannesburg",
      sanctionsScreened: true,
      prominentPersonScreened: true,
    };
    const errors = validateClientCapture(form);
    expect(errors.some((error) => error.includes("Authorised representative"))).toBe(true);
    expect(errors.some((error) => error.includes("Beneficial-owner"))).toBe(true);
  });

  it("requires purchaser source of funds only during FICA onboarding", () => {
    const form = {
      ...createInitialClientCapture(),
      name: "Nomsa Dlamini",
      roles: ["purchaser" as const],
      mobile: "+27 82 123 4567",
      privacyNoticeDelivered: true,
      startFica: true,
      idNumber: "8001015009087",
      dateOfBirth: "1980-01-01",
      addressLine: "1 Main Road",
      city: "Johannesburg",
      sanctionsScreened: true,
      prominentPersonScreened: true,
    };
    expect(validateClientCapture(form)).toContain(
      "Source of funds is required when onboarding a purchaser.",
    );
  });
});
