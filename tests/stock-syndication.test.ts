import { describe, it, expect } from "vitest";
import { generatePropertyXmlFeed } from "../src/services/stockAndSyndicationService";

describe("Agency Stock Control & Portal XML Syndication (Module 2)", () => {
  it("generates valid XML property listing feed for portal syndication", () => {
    const properties = [
      {
        id: "prop-101",
        title: "Luxury 3 Bed House in Sea Point",
        priceCents: 450000000,
        bedrooms: 3,
        bathrooms: 2,
        propertyType: "house",
        address: "45 Beach Road, Sea Point",
      },
    ];

    const xml = generatePropertyXmlFeed("Dream Supreme Properties", properties);

    expect(xml).toContain('<feed agency="Dream Supreme Properties">');
    expect(xml).toContain('<listing id="prop-101">');
    expect(xml).toContain("<priceCents>450000000</priceCents>");
    expect(xml).toContain("<propertyType>house</propertyType>");
  });

  it("handles empty inventory lists cleanly without breaking XML structure", () => {
    const xml = generatePropertyXmlFeed("Dream Supreme Properties", []);

    expect(xml).toContain('<feed agency="Dream Supreme Properties">');
    expect(xml).toContain("<properties>");
    expect(xml).toContain("</properties>");
  });
});
