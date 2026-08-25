import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { type AgentSeniority, type Role } from "@/types";
import { DEFAULT_USER_STORAGE_LIMIT_BYTES } from "@/lib/storage";
import { seniorityFromDb } from "@/lib/domain";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  seniority: AgentSeniority;
  active: boolean;
  colour: string;
  agencyId?: string;
  branchId?: string | null;
  commissionPct?: number;
  activeDeals?: number;
  ytdRevenue?: number;
  storageLimitBytes: number;
  storageUsedBytes: number;
  /** Public Property24 estate-agent profile URL, if the admin captured one. */
  property24Url?: string | null;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // 1. Fetch active registered user accounts from PostgreSQL migration schema (public.user_account)
      const { data: accounts, error: accountErr } = await supabase
        .from("user_account")
        .select(
          `id, full_name, email, role, seniority, status, agency_id, branch_id, commission_pct,
           storage_limit_bytes, storage_used_bytes, property24_url`,
        )
        .neq("status", "archived")
        .neq("status", "suspended");
      if (accountErr) throw accountErr;

      // 2. Fetch pending invitations from PostgreSQL migration schema (public.user_invitation)
      const { data: invitations, error: inviteErr } = await supabase
        .from("user_invitation")
        .select("id, email, role, seniority, agency_id, accepted_at, property24_url")
        .is("accepted_at", null);
      if (inviteErr) throw inviteErr;

      const registeredUsers: AdminUser[] = (accounts || []).map(
        (u: Record<string, unknown>): AdminUser => {
          const rawRole = (typeof u.role === "string" ? u.role : "agent").toLowerCase();
          const formattedRole: Role =
            rawRole.includes("admin") && rawRole.includes("agent")
              ? "Admin & Agent"
              : rawRole.includes("admin")
                ? "Admin"
                : "Agent";

          const limit =
            typeof u.storage_limit_bytes === "number"
              ? u.storage_limit_bytes
              : DEFAULT_USER_STORAGE_LIMIT_BYTES;
          const used = typeof u.storage_used_bytes === "number" ? u.storage_used_bytes : 0;

          return {
            id: String(u.id),
            name:
              typeof u.full_name === "string" && u.full_name.trim()
                ? u.full_name
                : String(u.email || "Team Member"),
            email: typeof u.email === "string" ? u.email : "unknown@example.com",
            role: formattedRole,
            seniority: seniorityFromDb[u.seniority as string] ?? "Candidate",
            active: u.status === "active",
            colour: "#4f46e5",
            agencyId: typeof u.agency_id === "string" ? u.agency_id : "",
            branchId: typeof u.branch_id === "string" ? u.branch_id : null,
            commissionPct: typeof u.commission_pct === "number" ? u.commission_pct : 50,
            storageLimitBytes: limit,
            storageUsedBytes: used,
            property24Url: typeof u.property24_url === "string" ? u.property24_url : null,
          };
        },
      );

      const pendingUsers: AdminUser[] = (invitations || []).map(
        (i: Record<string, unknown>): AdminUser => {
          const rawRole = (typeof i.role === "string" ? i.role : "agent").toLowerCase();
          const formattedRole: Role =
            rawRole.includes("admin") && rawRole.includes("agent")
              ? "Admin & Agent"
              : rawRole.includes("admin")
                ? "Admin"
                : "Agent";

          return {
            id: `invite-${i.id}`,
            name: `${typeof i.email === "string" ? i.email.split("@")[0] : "Invited"} (Pending Invite)`,
            email: typeof i.email === "string" ? i.email : "",
            role: formattedRole,
            seniority: seniorityFromDb[i.seniority as string] ?? "Candidate",
            active: false,
            colour: "#eab308",
            agencyId: typeof i.agency_id === "string" ? i.agency_id : "",
            branchId: null,
            commissionPct: 50,
            storageLimitBytes: DEFAULT_USER_STORAGE_LIMIT_BYTES,
            storageUsedBytes: 0,
            property24Url: typeof i.property24_url === "string" ? i.property24_url : null,
          };
        },
      );

      return [...registeredUsers, ...pendingUsers];
    },
  });
}

export function useUpdateUserStorageQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newLimitBytes }: { userId: string; newLimitBytes: number }) => {
      // Direct PostgreSQL update on user_account table
      const { data, error } = await supabase
        .from("user_account")
        .update({ storage_limit_bytes: newLimitBytes })
        .eq("id", userId)
        .select();

      if (error) {
        // Fallback to RPC function if direct RLS update requires security definer RPC
        const { error: rpcErr } = await supabase.rpc("update_user_storage_quota", {
          target_user_id: userId,
          new_limit_bytes: newLimitBytes,
        });
        if (rpcErr) throw rpcErr;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
