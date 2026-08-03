export interface BankStatementTransaction {
  date: string;
  payee: string;
  reference: string;
  amountCents: number;
  type: "credit" | "debit";
}

/**
 * Parses Open Financial Exchange (OFX/QFX) text string into structured transactions.
 */
export function parseOfxBankStatement(ofxContent: string): BankStatementTransaction[] {
  const transactions: BankStatementTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];

    const amountMatch = block.match(/<TRNAMT>([-+]?\d+\.?\d*)/i);
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);
    const payeeMatch = block.match(/<NAME>([^<\r\n]+)/i);
    const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);

    if (amountMatch && dateMatch) {
      const rawAmt = parseFloat(amountMatch[1]);
      const amountCents = Math.round(Math.abs(rawAmt) * 100);
      const rawDate = dateMatch[1];
      const formattedDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const payee = payeeMatch ? payeeMatch[1].trim() : "Unknown";
      const reference = memoMatch ? memoMatch[1].trim() : payee;

      transactions.push({
        date: formattedDate,
        payee,
        reference,
        amountCents,
        type: rawAmt >= 0 ? "credit" : "debit",
      });
    }
  }

  return transactions;
}
