import { describe, expect, it } from "vitest";
import { parseTemplateMerge } from "@/data/templates";

describe("parseTemplateMerge utility", () => {
  it("replaces exact placeholder matches with string values", () => {
    const template = "Dear {{ clientName }}, your mandate for {{ propertyAddress }} is active.";
    const variables = {
      clientName: "John Doe",
      propertyAddress: "123 Main Street",
    };
    const result = parseTemplateMerge(template, variables);
    expect(result).toBe("Dear John Doe, your mandate for 123 Main Street is active.");
  });

  it("handles whitespace around placeholder variable names", () => {
    const template = "Hello {{name}}, welcome to {{    agency    }}!";
    const variables = {
      name: "Alice",
      agency: "Dream Supreme Properties",
    };
    const result = parseTemplateMerge(template, variables);
    expect(result).toBe("Hello Alice, welcome to Dream Supreme Properties!");
  });

  it("replaces numeric variables correctly", () => {
    const template = "Commission is {{ rate }}% on sale price of R {{ amount }}.";
    const variables = {
      rate: 6,
      amount: 2500000,
    };
    const result = parseTemplateMerge(template, variables);
    expect(result).toBe("Commission is 6% on sale price of R 2500000.");
  });

  it("replaces null and undefined variables with empty string", () => {
    const template = "Buyer: {{ buyerName }}, Co-buyer: {{ cobuyerName }}.";
    const variables = {
      buyerName: "Jane Smith",
      cobuyerName: null,
    };
    const result = parseTemplateMerge(template, variables);
    expect(result).toBe("Buyer: Jane Smith, Co-buyer: .");
  });

  it("leaves unmatched placeholders untouched when variable key is not provided", () => {
    const template = "Property {{ erfNumber }} at {{ address }}.";
    const variables = {
      erfNumber: "ERF 456",
    };
    const result = parseTemplateMerge(template, variables);
    expect(result).toBe("Property ERF 456 at {{ address }}.");
  });
});
