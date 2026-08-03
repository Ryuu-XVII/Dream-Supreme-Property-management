export interface GeneralLedgerSyncItem {
  transactionId: string;
  date: string;
  accountCode: string;
  description: string;
  amountCents: number;
  taxCode: string;
}

/**
 * Formats general ledger batch export payload for Xero, QuickBooks, or Sage integrations.
 */
export function formatGeneralLedgerExportPayload(
  platform: "xero" | "quickbooks" | "sage",
  items: GeneralLedgerSyncItem[],
): Record<string, unknown> {
  return {
    platform,
    exported_at: new Date().toISOString(),
    item_count: items.length,
    total_cents: items.reduce((sum, item) => sum + item.amountCents, 0),
    line_items: items.map((i) => ({
      tx_id: i.transactionId,
      date: i.date,
      account_code: i.accountCode,
      description: i.description,
      amount_cents: i.amountCents,
      tax_code: i.taxCode,
    })),
  };
}
