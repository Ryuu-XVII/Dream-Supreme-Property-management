export interface InterestAllocationResult {
  success: boolean;
  period: string;
  accounts_processed: number;
  total_gross_interest_cents: number;
  total_client_interest_cents: number;
  total_ppra_levy_cents: number;
}

/**
 * Calculates interest split (95% client, 5% PPRA) statutorily mandated by
 * Property Practitioners Act Section 86(4).
 */
export function calculateStatutoryInterestSplit(grossInterestCents: number): {
  clientInterestCents: number;
  ppraLevyCents: number;
} {
  if (grossInterestCents <= 0) {
    return { clientInterestCents: 0, ppraLevyCents: 0 };
  }
  const clientInterestCents = Math.round(grossInterestCents * 0.95);
  const ppraLevyCents = grossInterestCents - clientInterestCents;
  return { clientInterestCents, ppraLevyCents };
}
