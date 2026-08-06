import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface PropertyData {
  id: string;
  address: string;
  type: string;
  price: number;
  status: string;
  agent: string;
  listedAt: string;
  daysOnMarket: number;
  lastAudit?: string;
}

export function useAdminProperties() {
  return useQuery({
    queryKey: ["admin-properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("property").select(`
        id,
        address_line,
        suburb,
        city,
        property_type,
        created_at,
        mandates:mandate(listing_price_cents, expires_on),
        deals:deal(id, status, stage, sale_price_cents, participants:deal_participant(role, user:user_account_id(full_name)))
      `);

      if (error) {
        console.error(error);
        return [];
      }

      return data.map((p: Record<string, unknown>): PropertyData => {
        const addressLine1 = typeof p.address_line === "string" ? p.address_line : "";
        const addressLine2 = typeof p.suburb === "string" ? p.suburb : "";
        const city = typeof p.city === "string" ? p.city : "";
        const address = [addressLine1, addressLine2, city].filter(Boolean).join(", ");

        const createdAtStr =
          typeof p.created_at === "string" ? p.created_at : new Date().toISOString();
        const createdDate = new Date(createdAtStr);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - createdDate.getTime());
        const daysOnMarket = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const deals = Array.isArray(p.deals) ? (p.deals as any[]) : [];
        const mandates = Array.isArray(p.mandates) ? (p.mandates as any[]) : [];
        const currentDeal = deals.find((deal) => deal.status === "active") ?? deals[0];
        const agentParticipant =
          currentDeal?.participants?.find(
            (participant: any) => participant.role === "listing_agent",
          ) ?? currentDeal?.participants?.[0];
        return {
          id: String(p.id),
          address: address || "No Address Provided",
          type:
            typeof p.property_type === "string" ? p.property_type.replaceAll("_", " ") : "other",
          price: currentDeal?.sale_price_cents ?? mandates[0]?.listing_price_cents ?? 0,
          status: currentDeal?.status ?? (mandates.length ? "mandated" : "unlisted"),
          agent: agentParticipant?.user?.full_name ?? "Unassigned",
          listedAt: createdAtStr,
          daysOnMarket: daysOnMarket,
        };
      });
    },
  });
}
