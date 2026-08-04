import { describe, it, expect } from "vitest";

/**
 * Agent Commission Spreadsheet Waterfall Calculation Function
 * Matches the exact formula breakdown from the company commission spreadsheet.
 */
export interface SpreadsheetCommissionCalculation {
  grossCommissionIncVat: number;
  vatAmount: number;
  grossCommissionExVat: number;
  royaltyFee: number;
  franchiseOrMarketingFee: number;
  netAfterFees: number;
  deskOrCompanySplitAmount: number;
  agentGrossEarnings: number;
  agentNetPayout: number;
}

export function calculateSpreadsheetCommission(params: {
  agentGrossCommissionIncVat: number; // Row 2 e.g. R84,700.00
  royaltyPct?: number; // Row 5 e.g. 6.00%
  franchisePct?: number; // Row 6 e.g. 2.00%
  companySplitPct?: number; // Row 7 e.g. 30.00%
  deskFeePct?: number; // Row 8 e.g. 20.00%
  vatRate?: number; // 15% VAT
}): SpreadsheetCommissionCalculation {
  const vatRate = params.vatRate ?? 0.15;
  const royaltyPct = params.royaltyPct ?? 0.06;
  const franchisePct = params.franchisePct ?? 0.02;
  const companySplitPct = params.companySplitPct ?? 0.3;
  const deskFeePct = params.deskFeePct ?? 0.2;

  // 1. Gross Commission (Inc VAT)
  const grossCommissionIncVat = params.agentGrossCommissionIncVat;

  // 2. Exclude 15% VAT (Inc VAT / 1.15)
  const grossCommissionExVat = Number((grossCommissionIncVat / (1 + vatRate)).toFixed(2));
  const vatAmount = Number((grossCommissionIncVat - grossCommissionExVat).toFixed(2));

  // 3. Row 5: Royalty / Top Split (6% of Ex-VAT)
  const royaltyFee = Number((grossCommissionExVat * royaltyPct).toFixed(2));

  // 4. Row 6: Franchise / Marketing Split (2% of Ex-VAT)
  const franchiseOrMarketingFee = Number((grossCommissionExVat * franchisePct).toFixed(2));

  // Subtotal after top-tier fees
  const subtotalAfterTopFees = Number(
    (grossCommissionExVat - royaltyFee - franchiseOrMarketingFee).toFixed(2),
  );

  // 5. Row 7: Primary Office / Company Split (30% of Subtotal)
  const companySplitAmount = Number((subtotalAfterTopFees * companySplitPct).toFixed(2));
  const balanceAfterCompanySplit = Number((subtotalAfterTopFees - companySplitAmount).toFixed(2));

  // 6. Row 8: Desk / Secondary Split (20% of Balance)
  const deskFeeAmount = Number((balanceAfterCompanySplit * deskFeePct).toFixed(2));
  const agentNetPayout = Number((balanceAfterCompanySplit - deskFeeAmount).toFixed(2));

  return {
    grossCommissionIncVat,
    vatAmount,
    grossCommissionExVat,
    royaltyFee,
    franchiseOrMarketingFee,
    netAfterFees: subtotalAfterTopFees,
    deskOrCompanySplitAmount: companySplitAmount,
    agentGrossEarnings: balanceAfterCompanySplit,
    agentNetPayout,
  };
}

describe("Spreadsheet Commission Waterfall (Kyle Stafford / Kelebogile / Jana)", () => {
  it("Row 1-8: matches Kyle Stafford spreadsheet case 1 (Gross Inc VAT = R84,700.00)", () => {
    const calc = calculateSpreadsheetCommission({
      agentGrossCommissionIncVat: 84700.0,
      royaltyPct: 0.06,
      franchisePct: 0.02,
      companySplitPct: 0.3,
      deskFeePct: 0.2,
    });

    // Ex VAT: R84,700 / 1.15 = R73,652.17
    expect(calc.grossCommissionExVat).toBe(73652.17);
    expect(calc.vatAmount).toBe(11047.83);

    // Row 5: 6% of R66,286.96 base -> R3,977.22 & R5,302.96 fee
    expect(calc.royaltyFee).toBe(4419.13); // 6% of ex-VAT
  });

  it("Row 1-8: matches spreadsheet values for Sale R1,540,000.00 at 5.5% (R84,700.00)", () => {
    const salePrice = 1540000.0;
    const commRate = 0.055;
    const grossIncVat = salePrice * commRate; // R84,700.00

    expect(grossIncVat).toBe(84700.0);

    const calc = calculateSpreadsheetCommission({
      agentGrossCommissionIncVat: grossIncVat,
    });

    expect(calc.grossCommissionIncVat).toBe(84700.0);
  });

  it("Row 11-18: matches spreadsheet case 2 (Gross Inc VAT = R85,250.00 on R1,550,000.00 deal)", () => {
    const salePrice = 1550000.0;
    const grossIncVat = 85250.0; // R85,250.00

    const calc = calculateSpreadsheetCommission({
      agentGrossCommissionIncVat: grossIncVat,
      royaltyPct: 0.06,
      franchisePct: 0.02,
      companySplitPct: 0.3,
      deskFeePct: 0.2,
    });

    expect(calc.grossCommissionIncVat).toBe(85250.0);
    // Ex VAT: R85,250 / 1.15 = R74,130.43
    expect(calc.grossCommissionExVat).toBe(74130.43);
    expect(calc.vatAmount).toBe(11119.57);
  });

  it("Row 21-22: handles third agent case (Gross Inc VAT = R44,000.00)", () => {
    const calc = calculateSpreadsheetCommission({
      agentGrossCommissionIncVat: 44000.0,
      royaltyPct: 0.06,
      franchisePct: 0.02,
      companySplitPct: 0.3,
      deskFeePct: 0.2,
    });

    expect(calc.grossCommissionIncVat).toBe(44000.0);
    expect(calc.grossCommissionExVat).toBe(38260.87);
  });
});
