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
      // In a real app we'd join with user_account and deal tables.
      // Here we fetch basic property info.
      const { data, error } = await supabase.from("property").select(`
        id,
        address_line1,
        address_line2,
        city,
        type,
        created_at
      `);

      if (error) {
        console.error(error);
        return [];
      }

      return data.map((p: Record<string, unknown>): PropertyData => {
        const addressLine1 = typeof p.address_line1 === "string" ? p.address_line1 : "";
        const addressLine2 = typeof p.address_line2 === "string" ? p.address_line2 : "";
        const city = typeof p.city === "string" ? p.city : "";
        const address = [addressLine1, addressLine2, city].filter(Boolean).join(", ");

        const createdAtStr =
          typeof p.created_at === "string" ? p.created_at : new Date().toISOString();
        const createdDate = new Date(createdAtStr);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - createdDate.getTime());
        const daysOnMarket = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          id: String(p.id),
          address: address || "No Address Provided",
          type: typeof p.type === "string" ? p.type : "Residential",
          price: 0, // Need to mock or fetch from mandate/deal if required
          status: "Available",
          agent: "Unassigned",
          listedAt: createdAtStr,
          daysOnMarket: daysOnMarket,
        };
      });
    },
  });
}
