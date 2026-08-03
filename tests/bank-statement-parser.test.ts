import { describe, it, expect } from "vitest";
import { parseOfxBankStatement } from "../src/services/bankStatementParserService";

describe("OFX / MT940 Drag-and-Drop Bank Statement Reconciliation Parser (Pillar 2)", () => {
  it("parses valid OFX bank statement file into structured transaction lines", () => {
    const ofxSample = `
      <OFX>
        <STMTTRN>
          <TRNTYPE>CREDIT</TRNTYPE>
          <DTPOSTED>20260801</DTPOSTED>
          <TRNAMT>15000.00</TRNAMT>
          <NAME>TENANT DEPOSIT RENT</NAME>
          <MEMO>INV-LEASE-9988</MEMO>
        </STMTTRN>
      </OFX>
    `;

    const txs = parseOfxBankStatement(ofxSample);

    expect(txs).toHaveLength(1);
    expect(txs[0].date).toBe("2026-08-01");
    expect(txs[0].amountCents).toBe(1500000); // R15,000.00 in cents
    expect(txs[0].type).toBe("credit");
    expect(txs[0].reference).toBe("INV-LEASE-9988");
  });
});
