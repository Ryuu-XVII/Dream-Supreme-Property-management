import { describe, expect, it } from "vitest";
import {
  parseP24ListingUrl,
  parseP24Size,
  propertyTypeFromP24Title,
} from "@/lib/property24-listing";

describe("Property24 size labels", () => {
  // Property24 writes thousands separators as non-breaking spaces, which is
  // why the parser strips whitespace rather than only ASCII spaces.
  it.each([
    ["50 m²", 50],
    ["1 960 m²", 1960],
    ["2 500 m²", 2500],
    ["1 340 m²", 1340],
  ])("reads %s as %i m²", (label, expected) => {
    expect(parseP24Size(label)).toBe(expected);
  });

  it.each([
    ["1 ha", 10_000],
    ["4.28 ha", 42_800],
    ["8.5 ha", 85_000],
    ["9.15 ha", 91_500],
  ])("converts %s to %i m²", (label, expected) => {
    expect(parseP24Size(label)).toBe(expected);
  });

  it.each([null, undefined, "", "ask agent", "on request", "m²"])(
    "returns null rather than a wrong number for %s",
    (label) => {
      // A wrong erf size on a transfer instruction is worse than a blank one.
      expect(parseP24Size(label as string | null | undefined)).toBeNull();
    },
  );

  it("rejects a zero or negative size", () => {
    expect(parseP24Size("0 m²")).toBeNull();
  });
});

describe("Property24 tile titles", () => {
  it.each([
    ["4 Bedroom House", "Freehold House"],
    ["3 Bedroom House", "Freehold House"],
    ["2 Bedroom Townhouse", "Townhouse"],
    ["1 Bedroom Apartment", "Sectional Title"],
    ["Studio Flat", "Sectional Title"],
    ["Farm", "Farm"],
    ["Smallholding", "Farm"],
    ["Commercial Property", "Commercial"],
    ["Office Space", "Commercial"],
    ["Industrial Property", "Industrial"],
    ["Warehouse", "Industrial"],
    ["Vacant Land", "Vacant Land"],
  ])("maps %s to %s", (title, expected) => {
    expect(propertyTypeFromP24Title(title)).toBe(expected);
  });

  it.each([null, undefined, "", "Repossessed Property"])(
    "returns null for %s so the form keeps its own default",
    (title) => {
      expect(propertyTypeFromP24Title(title as string | null | undefined)).toBeNull();
    },
  );

  it("prefers the more specific type when a title could match twice", () => {
    // "Townhouse" contains "house"; the townhouse rule must win.
    expect(propertyTypeFromP24Title("2 Bedroom Townhouse")).toBe("Townhouse");
  });
});

describe("Property24 listing URLs", () => {
  // The tile shows only a suburb; the URL is the sole published source for
  // city and province.
  it("reads suburb, city and province from the path", () => {
    expect(
      parseP24ListingUrl(
        "https://www.property24.com/for-sale/pretoria-north/pretoria/gauteng/393/117430041",
      ),
    ).toEqual({ suburb: "Pretoria North", city: "Pretoria", province: "Gauteng" });
  });

  it("handles a rental URL the same way", () => {
    expect(
      parseP24ListingUrl(
        "https://www.property24.com/to-rent/umhlanga/durban/kwazulu-natal/123/456",
      ),
    ).toEqual({ suburb: "Umhlanga", city: "Durban", province: "KwaZulu-Natal" });
  });

  it.each([
    ["gauteng", "Gauteng"],
    ["kwazulu-natal", "KwaZulu-Natal"],
    ["western-cape", "Western Cape"],
    ["north-west", "North West"],
    ["northern-cape", "Northern Cape"],
    ["eastern-cape", "Eastern Cape"],
    ["free-state", "Free State"],
    ["mpumalanga", "Mpumalanga"],
    ["limpopo", "Limpopo"],
  ])("maps the %s slug to the exact Select option %s", (slug, expected) => {
    // A value outside the Select's options would leave the field looking empty
    // while holding something the user never chose.
    const result = parseP24ListingUrl(
      `https://www.property24.com/for-sale/suburb/city/${slug}/1/2`,
    );
    expect(result.province).toBe(expected);
  });

  it("leaves the province unset for a slug it does not recognise", () => {
    const result = parseP24ListingUrl(
      "https://www.property24.com/for-sale/suburb/city/atlantis/1/2",
    );
    expect(result.province).toBeUndefined();
    expect(result.suburb).toBe("Suburb");
  });

  it.each(["https://www.property24.com/for-sale/too/short", "not-a-url", ""])(
    "returns nothing usable for %s rather than writing junk",
    (url) => {
      expect(parseP24ListingUrl(url)).toEqual({});
    },
  );

  it.each([null, undefined])("tolerates %s", (url) => {
    expect(parseP24ListingUrl(url as string | null | undefined)).toEqual({});
  });
});
