export interface EftPayoutItem {
  agentName: string;
  bankName: string;
  accountNumber: string;
  branchCode: string;
  amountCents: number;
  reference: string;
}

/**
 * Generates South African ACB / EFT CSV batch payout file content for direct agent payouts.
 */
export function generateEftBatchCsv(batchNumber: string, payouts: EftPayoutItem[]): string {
  const header = "BATCH_REF,AGENT_NAME,BANK,ACCOUNT_NO,BRANCH_CODE,AMOUNT_CENTS,REFERENCE\n";
  const rows = payouts
    .map(
      (p) =>
        `${batchNumber},"${p.agentName}","${p.bankName}","${p.accountNumber}","${p.branchCode}",${p.amountCents},"${p.reference}"`,
    )
    .join("\n");

  return header + rows;
}
