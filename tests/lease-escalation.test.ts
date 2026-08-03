import { describe, expect, it } from "vitest";

function calculateEscalatedRent(previousRentCents: number, escalationRateBps: number): number {
  if (previousRentCents <= 0 || escalationRateBps <= 0) return previousRentCents;
  const escalationFactor = 1 + escalationRateBps / 10000;
  return Math.round(previousRentCents * escalationFactor);
}

function calculateProRataRent(
  monthlyRentCents: number,
  startDay: number,
  daysInMonth: number,
  basis: "exact_calendar_days" | "standard_30_days" = "exact_calendar_days",
): number {
  if (startDay <= 1) return monthlyRentCents;
  const totalDays = basis === "standard_30_days" ? 30 : daysInMonth;
  const activeDays = Math.max(0, totalDays - startDay + 1);
  return Math.round((monthlyRentCents / totalDays) * activeDays);
}

describe("lease escalation and pro-rata rent calculations", () => {
  it("calculates annual lease rent escalation correctly", () => {
    // R15,000 rent escalated by 8% (800 bps) -> R16,200
    const previous = 1_500_000;
    const escalated = calculateEscalatedRent(previous, 800);
    expect(escalated).toBe(1_620_000);
  });

  it("returns unchanged rent when escalation rate is 0", () => {
    expect(calculateEscalatedRent(1_500_000, 0)).toBe(1_500_000);
  });

  it("calculates exact calendar day pro-rata rent", () => {
    // R10,000 monthly rent, lease starts on the 16th of a 30-day month (15 active days)
    const proRata = calculateProRataRent(1_000_000, 16, 30, "exact_calendar_days");
    expect(proRata).toBe(500_000);
  });

  it("calculates standard 30-day basis pro-rata rent", () => {
    // R10,000 monthly rent, lease starts on 16th in a 31-day month using standard 30-day basis
    const proRata = calculateProRataRent(1_000_000, 16, 31, "standard_30_days");
    expect(proRata).toBe(500_000);
  });

  it("returns full rent if starting on 1st of month", () => {
    expect(calculateProRataRent(1_000_000, 1, 31)).toBe(1_000_000);
  });
});
