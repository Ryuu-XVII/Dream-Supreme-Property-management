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
      // 1. Fetch active registered user accounts from PostgreSQL migration schema (public.user_account)
      const { data: accounts, error: accountErr } = await supabase.from("user_account").select("*");
      if (accountErr) console.error("Error fetching user_account:", accountErr);

      // 2. Fetch pending invitations from PostgreSQL migration schema (public.user_invitation)
      const { data: invitations, error: inviteErr } = await supabase
        .from("user_invitation")
        .select("*")
        .is("accepted_at", null);
      if (inviteErr) console.error("Error fetching user_invitation:", inviteErr);

      const registeredUsers: AdminUser[] = (accounts || []).map(
        (u: Record<string, unknown>): AdminUser => {
          const rawRole = (typeof u.role === "string" ? u.role : "agent").toLowerCase();
          const formattedRole: Role =
            rawRole === "admin" || rawRole === "principal" ? "Admin" : "Agent";

          return {
            id: String(u.id),
            name:
              typeof u.full_name === "string" && u.full_name.trim()
                ? u.full_name
                : String(u.email || "Team Member"),
            email: typeof u.email === "string" ? u.email : "unknown@example.com",
            role: formattedRole,
            active: u.status === "active",
            colour: "#4f46e5",
            commissionPct: typeof u.commission_pct === "number" ? u.commission_pct : 50,
          };
        },
      );

      const pendingUsers: AdminUser[] = (invitations || []).map(
        (i: Record<string, unknown>): AdminUser => {
          const rawRole = (typeof i.role === "string" ? i.role : "agent").toLowerCase();
          const formattedRole: Role =
            rawRole === "admin" || rawRole === "principal" ? "Admin" : "Agent";

          return {
            id: `invite-${i.id}`,
            name: `${typeof i.email === "string" ? i.email.split("@")[0] : "Invited"} (Pending Invite)`,
            email: typeof i.email === "string" ? i.email : "",
            role: formattedRole,
            active: false,
            colour: "#eab308",
            commissionPct: 50,
          };
        },
      );

      return [...registeredUsers, ...pendingUsers];
    },
  });
}
