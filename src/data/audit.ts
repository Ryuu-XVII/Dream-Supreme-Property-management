import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select(
          `
          id,
          action,
          entity_type,
          entity_id,
          after_json,
          ip_address,
          occurred_at,
          actor_id
        `,
        )
        .order("occurred_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error(error);
        return [];
      }

      return data.map((log: Record<string, unknown>): AuditLogEntry => {
        return {
          id: String(log.id),
          actor: "System/User", // In real app, join with user_account
          action: typeof log.action === "string" ? log.action : "UPDATE",
          entity: typeof log.entity_type === "string" ? log.entity_type : "Unknown",
          entityId: typeof log.entity_id === "string" ? log.entity_id : "-",
          details: log.after_json ? JSON.stringify(log.after_json) : "No details",
          ipAddress: typeof log.ip_address === "string" ? log.ip_address : "127.0.0.1",
          timestamp: typeof log.occurred_at === "string" ? log.occurred_at : new Date().toISOString(),
        };
      });
    },
  });
}
