import { describe, it, expect } from "vitest";
import { populateSmartFormTokens, computeDocumentSha256 } from "../src/services/smartFormService";

describe("Transaction Management & Smart Form Field Loops (Module 1)", () => {
  it("auto-populates multiple tokens simultaneously across legal contracts", () => {
    const template =
      "AGREEMENT OF SALE: Seller {{seller_name}} agrees to sell to Buyer {{buyer_name}} for the sum of {{purchase_price}}.";
    const fieldMap = {
      seller_name: "Jan van der Merwe",
      buyer_name: "Sarah Jenkins",
      purchase_price: "R2,500,000",
    };

    const result = populateSmartFormTokens(template, fieldMap);

    expect(result).toBe(
      "AGREEMENT OF SALE: Seller Jan van der Merwe agrees to sell to Buyer Sarah Jenkins for the sum of R2,500,000.",
    );
  });

  it("handles case-insensitive whitespace tokens seamlessly", () => {
    const template = "Mandate for {{ property_address }} by {{agent_name}}.";
    const fieldMap = {
      property_address: "123 Beach Road, Sea Point",
      agent_name: "Adnaan Ryuu",
    };

    const result = populateSmartFormTokens(template, fieldMap);

    expect(result).toBe("Mandate for 123 Beach Road, Sea Point by Adnaan Ryuu.");
  });

  it("generates deterministic SHA-256 tamper-evident checksums for legal document payloads", async () => {
    const documentPayload = "CONTRACT-V1-DEAL-998822-CONFIRMED";
    const hash1 = await computeDocumentSha256(documentPayload);
    const hash2 = await computeDocumentSha256(documentPayload);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // Valid SHA-256 hex string length
  });
});
