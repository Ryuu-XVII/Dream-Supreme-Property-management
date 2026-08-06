import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { type Role } from "@/types";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  colour: string;
  commissionPct?: number;
  activeDeals?: number;
  ytdRevenue?: number;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // In a real scenario, this would likely be an RPC call or admin view that aggregates data.
      // For now, we fetch from user_account and mock the stats.
      const { data, error } = await supabase.from("user_account").select("*");

      if (error) {
        console.error(error);
        return [];
      }

      return data.map((u: Record<string, unknown>): AdminUser => {
        const rawRole = (typeof u.role === "string" ? u.role : "agent").toLowerCase();
        const formattedRole: Role =
          rawRole === "admin" || rawRole === "principal" ? "Admin" : "Agent";

        return {
          id: String(u.id),
          name: typeof u.full_name === "string" ? u.full_name : "Unknown",
          email: typeof u.email === "string" ? u.email : "unknown@example.com",
          role: formattedRole,
          active: u.status === "active",
          colour: "#4f46e5",
          commissionPct: typeof u.commission_pct === "number" ? u.commission_pct : 50,
        };
      });
    },
  });
}
