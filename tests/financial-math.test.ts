import { describe, expect, it } from "vitest";

function calculateBondInstalment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  const totalPayments = years * 12;
  if (monthlyRate === 0) return principal / totalPayments;
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1)
  );
}

function calculateYieldMetrics(
  price: number,
  rental: number,
  monthlyCosts: { rates: number; levy: number; insurance: number; maintenance: number },
) {
  const totalMonthlyCosts =
    monthlyCosts.rates + monthlyCosts.levy + monthlyCosts.insurance + monthlyCosts.maintenance;
  const annualRental = rental * 12;
  const annualCosts = totalMonthlyCosts * 12;

  const grossYield = (annualRental / price) * 100;
  const netYield = ((annualRental - annualCosts) / price) * 100;
  const monthlyCashFlow = rental - totalMonthlyCosts;
  const annualCashFlow = monthlyCashFlow * 12;
  const payback = annualCashFlow > 0 ? price / annualCashFlow : Infinity;

  return { grossYield, netYield, monthlyCashFlow, annualCashFlow, payback };
}

function calculateAffordability(
  income: number,
  expenses: number,
  annualRatePct: number,
  years: number,
  guidelinePct = 30,
) {
  const maxInstalment = income * (guidelinePct / 100);
  const monthlyRate = annualRatePct / 100 / 12;
  const n = years * 12;
  const maxLoan =
    monthlyRate === 0
      ? maxInstalment * n
      : (maxInstalment * (1 - Math.pow(1 + monthlyRate, -n))) / monthlyRate;
  const maxPurchasePrice = maxLoan / 0.9;
  const dti = ((expenses + maxInstalment) / income) * 100;

  return { maxInstalment, maxLoan, maxPurchasePrice, dti };
}

describe("bond payment calculations", () => {
  it("calculates standard monthly bond instalment correctly", () => {
    // R1,000,000 bond at 12% over 20 years
    const monthlyPayment = calculateBondInstalment(1_000_000, 12, 20);
    expect(monthlyPayment).toBeCloseTo(11010.86, 1);
  });

  it("handles 0% interest rate without divide-by-zero", () => {
    const payment = calculateBondInstalment(1_200_000, 0, 10);
    expect(payment).toBe(10000);
  });

  it("returns 0 for non-positive bond amounts", () => {
    expect(calculateBondInstalment(0, 10.5, 20)).toBe(0);
    expect(calculateBondInstalment(-100, 10.5, 20)).toBe(0);
  });
});

describe("property yield & cash flow calculations", () => {
  it("calculates gross and net yields accurately", () => {
    const price = 2_000_000;
    const rental = 20_000; // R240k/yr -> Gross 12%
    const costs = { rates: 1500, levy: 1500, insurance: 500, maintenance: 1500 }; // R5000/mo -> R60k/yr
    const result = calculateYieldMetrics(price, rental, costs);

    expect(result.grossYield).toBe(12.0);
    expect(result.netYield).toBe(9.0);
    expect(result.monthlyCashFlow).toBe(15000);
    expect(result.annualCashFlow).toBe(180000);
    expect(result.payback).toBeCloseTo(11.11, 2);
  });

  it("handles negative cash flow and infinite payback period", () => {
    const price = 2_000_000;
    const rental = 5_000;
    const costs = { rates: 2000, levy: 3000, insurance: 1000, maintenance: 1000 }; // R7000/mo
    const result = calculateYieldMetrics(price, rental, costs);

    expect(result.monthlyCashFlow).toBe(-2000);
    expect(result.payback).toBe(Infinity);
  });
});

describe("affordability & debt-to-income calculations", () => {
  it("calculates max instalment, loan amount, and DTI ratio", () => {
    const income = 60_000;
    const expenses = 10_000;
    const rate = 11.75;
    const term = 20;

    const res = calculateAffordability(income, expenses, rate, term, 30);

    expect(res.maxInstalment).toBe(18000); // 30% of 60,000
    expect(res.maxLoan).toBeGreaterThan(1500000);
    expect(res.maxPurchasePrice).toBeCloseTo(res.maxLoan / 0.9, 2);
    expect(res.dti).toBeCloseTo(((10000 + 18000) / 60000) * 100, 2);
  });
});
