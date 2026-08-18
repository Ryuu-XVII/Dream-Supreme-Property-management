// Helpers for turning a synced Property24 listing into a deal capture form.
//
// Extracted from the deal route so they can be tested directly: these decide
// what lands on a transfer instruction, and a wrong erf size or province is
// worse than a blank one.
import type { DealCaptureForm } from "@/lib/deal-capture";

/**
 * Property24 size labels look like "1 960 m²", "2 552 m²" or "9.15 ha".
 * Returns square metres, or null when the label cannot be read confidently —
 * a wrong erf size is worse than a blank one on a transfer instruction.
 */
export function parseP24Size(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = /([\d\s.,]+)\s*(m²|ha)/i.exec(label);
  if (!match) return null;
  const value = Number(match[1].replace(/[\s,]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return match[2].toLowerCase() === "ha" ? Math.round(value * 10_000) : Math.round(value);
}

// Only the exact strings the province Select offers. A value outside this list
// would leave the field looking empty while actually holding something the
// user never chose.
const P24_PROVINCE_BY_SLUG: Record<string, string> = {
  "eastern-cape": "Eastern Cape",
  "free-state": "Free State",
  gauteng: "Gauteng",
  "kwazulu-natal": "KwaZulu-Natal",
  limpopo: "Limpopo",
  mpumalanga: "Mpumalanga",
  "north-west": "North West",
  "northern-cape": "Northern Cape",
  "western-cape": "Western Cape",
};

const titleCaseSlug = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Property24 listing URLs carry the location the tile itself does not:
 * /for-sale/{suburb}/{city}/{province}/{areaId}/{listingId}. That is the only
 * published source for city and province, so it is worth reading.
 */
export function parseP24ListingUrl(url: string | null | undefined): {
  suburb?: string;
  city?: string;
  province?: string;
} {
  if (!url) return {};
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    // [for-sale|to-rent, suburb, city, province, areaId, listingId]
    if (parts.length < 6) return {};
    return {
      suburb: titleCaseSlug(parts[1]),
      city: titleCaseSlug(parts[2]),
      province: P24_PROVINCE_BY_SLUG[parts[3].toLowerCase()],
    };
  } catch {
    return {};
  }
}

/**
 * Best-effort property type from a Property24 tile title such as
 * "4 Bedroom House" or "Commercial Property". Returns null when nothing
 * matches, so the form keeps its own default rather than being told something
 * untrue.
 */
export function propertyTypeFromP24Title(
  title: string | null | undefined,
): DealCaptureForm["propertyType"] | null {
  const text = (title ?? "").toLowerCase();
  if (!text) return null;
  if (text.includes("farm") || text.includes("smallholding")) return "Farm";
  if (text.includes("commercial") || text.includes("office") || text.includes("retail"))
    return "Commercial";
  if (text.includes("industrial") || text.includes("warehouse")) return "Industrial";
  if (text.includes("vacant land") || text.includes("plot") || text.includes("stand"))
    return "Vacant Land";
  if (text.includes("townhouse")) return "Townhouse";
  if (text.includes("apartment") || text.includes("flat")) return "Sectional Title";
  if (text.includes("house")) return "Freehold House";
  return null;
}
