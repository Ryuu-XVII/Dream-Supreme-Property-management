import { describe, it, expect } from "vitest";
import { calculateStatutoryInterestSplit } from "../src/services/trustAccountingService";

describe("Property Practitioners Act Section 86(4) Interest Split Math", () => {
  it("correctly splits interest into 95% client and 5% PPRA for R1,000.00 (100000 cents)", () => {
    const grossCents = 100000;
    const split = calculateStatutoryInterestSplit(grossCents);

    expect(split.clientInterestCents).toBe(95000); // R950.00
    expect(split.ppraLevyCents).toBe(5000); // R50.00
    expect(split.clientInterestCents + split.ppraLevyCents).toBe(grossCents);
  });

  it("correctly handles penny amounts and guarantees zero cent leak (e.g. 105 cents)", () => {
    const grossCents = 105;
    const split = calculateStatutoryInterestSplit(grossCents);

    // 105 * 0.95 = 99.75 -> round to 100 cents
    expect(split.clientInterestCents).toBe(100);
    expect(split.ppraLevyCents).toBe(5); // 105 - 100 = 5 cents
    expect(split.clientInterestCents + split.ppraLevyCents).toBe(grossCents);
  });

  it("returns zero for 0 or negative gross interest", () => {
    expect(calculateStatutoryInterestSplit(0)).toEqual({
      clientInterestCents: 0,
      ppraLevyCents: 0,
    });
    expect(calculateStatutoryInterestSplit(-500)).toEqual({
      clientInterestCents: 0,
      ppraLevyCents: 0,
    });
  });

  it("reconciles 100% exact sum for non-even interest values (e.g. R4,567.89 / 456789 cents)", () => {
    const grossCents = 456789;
    const split = calculateStatutoryInterestSplit(grossCents);

    expect(split.clientInterestCents + split.ppraLevyCents).toBe(grossCents);
    expect(split.clientInterestCents).toBe(Math.round(456789 * 0.95));
  });
});
