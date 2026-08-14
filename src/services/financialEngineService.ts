export interface TieredCommissionResult {
  deal_id: string;
  gross_commission_cents: number;
  vat_cents: number;
  net_commission_cents: number;
  agent_split_pct: number;
  agent_payout_cents: number;
  agency_retention_cents: number;
}

export interface CdaInstructionPayload {
  dealId: string;
  conveyancerFirmName: string;
  conveyancerEmail?: string;
  grossCommissionCents: number;
  vatCents: number;
  netAgencyCents: number;
  agentPayoutCents: number;
  teamLeadOverrideCents?: number;
}

/**
 * Calculates client-side commission tiered splits for instant UI estimation.
 */
export function calculateTieredCommissionPreview(
  purchasePriceCents: number,
  grossPct = 5.0,
  agentSplitPct = 60.0,
  vatRate = 0.15,
): {
  grossCommissionCents: number;
  vatCents: number;
  netCommissionCents: number;
  agentPayoutCents: number;
  agencyRetentionCents: number;
} {
  const grossCommissionCents = Math.round(purchasePriceCents * (grossPct / 100));
  const vatCents = Math.round(grossCommissionCents * vatRate);
  const netCommissionCents = grossCommissionCents - vatCents;
  const agentPayoutCents = Math.round(netCommissionCents * (agentSplitPct / 100));
  const agencyRetentionCents = netCommissionCents - agentPayoutCents;

  return {
    grossCommissionCents,
    vatCents,
    netCommissionCents,
    agentPayoutCents,
    agencyRetentionCents,
  };
}
