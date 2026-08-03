import { supabase } from "@/lib/supabase";

export interface PropertyXmlFeedItem {
  id: string;
  title: string;
  priceCents: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  address: string;
}

export interface BuyerMatchResult {
  buyer_party_id: string;
  buyer_name: string;
  match_score: number;
}

/**
 * Formats property mandates into standardized XML feed payload for Property24/PrivateProperty.
 */
export function generatePropertyXmlFeed(
  agencyName: string,
  properties: PropertyXmlFeedItem[],
): string {
  const itemsXml = properties
    .map(
      (p) => `
    <listing id="${p.id}">
      <title>${p.title}</title>
      <priceCurrency>ZAR</priceCurrency>
      <priceCents>${p.priceCents}</priceCents>
      <bedrooms>${p.bedrooms}</bedrooms>
      <bathrooms>${p.bathrooms}</bathrooms>
      <propertyType>${p.propertyType}</propertyType>
      <address>${p.address}</address>
    </listing>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed agency="${agencyName}">
  <properties>${itemsXml}
  </properties>
</feed>`;
}

/**
 * Invokes public.match_buyers_for_mandate RPC via Supabase.
 */
export async function matchBuyersForMandate(mandateId: string): Promise<BuyerMatchResult[]> {
  const { data, error } = await supabase.rpc("match_buyers_for_mandate", {
    p_mandate_id: mandateId,
  });

  if (error) {
    throw new Error(`Failed to match buyers for mandate: ${error.message}`);
  }

  return (data || []) as BuyerMatchResult[];
}
