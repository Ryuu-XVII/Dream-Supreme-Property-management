import { describe, expect, it } from "vitest";
import {
  createEmptyParty,
  createInitialDealCapture,
  validateDealCapture,
  validateDealStep,
} from "./deal-capture";

function validParty() {
  return {
    ...createEmptyParty(),
    name: "Nomsa Dlamini",
    idNumber: "9505155000085",
    email: "nomsa@example.co.za",
    mobile: "0821234567",
    dateOfBirth: "1995-05-15",
    taxNumber: "0123456789",
    sourceOfFunds: "Salary savings and approved home loan",
    sanctionsScreened: true,
  };
}

function validDeal() {
  return {
    ...createInitialDealCapture(),
    address: "42 Example Road",
    suburb: "Morningside",
    legalDescription: "Erf 123 Morningside Township, Registration Division IR",
    titleDeedNumber: "T12345/2020",
    listingPrice: "2500000",
    salePrice: "2450000",
    agentId: "00000000-0000-0000-0000-000000000001",
    bondAmount: "2000000",
    sellers: [validParty()],
    purchasers: [validParty()],
    propertyDisclosureCompleted: true,
  };
}

describe("deal capture validation", () => {
  it("accepts a complete conveyancer-ready deal capture", () => {
    expect(validateDealCapture(validDeal())).toEqual([]);
  });

  it("requires the formal property description and title deed", () => {
    const deal = validDeal();
    deal.legalDescription = "";
    deal.titleDeedNumber = "";
    expect(validateDealStep(deal, 1)).toEqual(
      expect.arrayContaining([
        "The deeds-search legal description is required.",
        "The current title deed number is required.",
      ]),
    );
  });

  it("validates South African ID Luhn checksum for natural persons", () => {
    const deal = validDeal();
    deal.sellers[0].idNumber = "8001015009089"; // invalid checksum
    const errors = validateDealStep(deal, 2);
    expect(
      errors.some((err) => err.includes("Luhn check failed") || err.includes("ID number")),
    ).toBe(true);
  });

  it("validates email formatting", () => {
    const deal = validDeal();
    deal.sellers[0].email = "invalid-email";
    const errors = validateDealStep(deal, 2);
    expect(errors).toContain("Seller 1: enter a valid email address.");
  });

  it("requires tax numbers at the SARS R2 million threshold", () => {
    const deal = validDeal();
    deal.purchasers[0].taxNumber = "";
    expect(validateDealStep(deal, 2)).toContain(
      "Purchaser 1: SARS income-tax number is required for a transaction of R2 million or more.",
    );
  });

  it("requires beneficial ownership and authority for entity parties", () => {
    const deal = validDeal();
    deal.sellers[0] = {
      ...validParty(),
      entityType: "Trust",
      representativeName: "",
      representativeCapacity: "",
      beneficialOwnerDetails: "",
    };
    const errors = validateDealStep(deal, 2);
    expect(errors.some((error) => error.includes("authorised representative"))).toBe(true);
    expect(errors.some((error) => error.includes("beneficial-owner"))).toBe(true);
  });

  it("requires each side's ownership shares to total 100 percent", () => {
    const deal = validDeal();
    deal.sellers = [
      { ...validParty(), sharePercent: "60" },
      { ...validParty(), sharePercent: "30" },
    ];
    expect(validateDealStep(deal, 2)).toContain("Seller ownership shares must total 100%.");
  });

  it("enforces the VAT vendor requirement on step 3", () => {
    const deal = validDeal();
    deal.isVatSale = true;
    const errors = validateDealStep(deal, 3);
    expect(errors).toContain(
      "A VAT sale requires at least one seller to be recorded as a VAT vendor.",
    );
  });

  it("enforces the finance (bond) requirement on step 4, where the bond fields are captured", () => {
    const deal = validDeal();
    deal.bondAmount = "0";
    const errors = validateDealStep(deal, 4);
    expect(errors).toContain("Bond amount and approval deadline are required for a financed sale.");
  });

  it("requires sanctions screening for every transaction party", () => {
    const deal = validDeal();
    deal.purchasers[0].sanctionsScreened = false;
    expect(validateDealStep(deal, 2)).toContain(
      "Purchaser 1: targeted-financial-sanctions screening must be completed.",
    );
  });
});
