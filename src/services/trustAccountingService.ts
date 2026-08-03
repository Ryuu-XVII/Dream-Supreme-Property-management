import { supabase } from "@/lib/supabase";

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

/**
 * Triggers monthly Section 86(4) interest allocation RPC via Supabase.
 */
export async function triggerMonthlyInterestAllocation(
  agencyId?: string,
  periodDate?: string,
): Promise<InterestAllocationResult> {
  const { data, error } = await supabase.rpc("process_monthly_section_86_4_interest_allocation", {
    p_agency_id: agencyId || null,
    p_period_date: periodDate || new Date().toISOString().split("T")[0],
  });

  if (error) {
    throw new Error(`Failed to trigger monthly interest allocation: ${error.message}`);
  }

  return data as InterestAllocationResult;
}
