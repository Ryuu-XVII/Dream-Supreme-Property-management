import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface LeadRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  source: string;
  assignedTo?: string;
  assignedName?: string;
  status: string;
  createdAt: string;
  message: string;
  payload: Record<string, unknown> | null;
}

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<LeadRecord[]> => {
      const { data, error } = await supabase
        .from("lead")
        .select(
          "id, full_name, email, mobile, source, status, message, calculator_payload_json, assigned_to, created_at, assignee:assigned_to(full_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((lead: any) => ({
        id: lead.id,
        name: lead.full_name,
        email: lead.email ?? "",
        mobile: lead.mobile ?? "",
        source: lead.source,
        assignedTo: lead.assigned_to ?? undefined,
        assignedName: lead.assignee?.full_name ?? undefined,
        status: lead.status,
        createdAt: lead.created_at,
        message: lead.message ?? "",
        payload: lead.calculator_payload_json,
      }));
    },
  });
}

export function useUpdateLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      assignedTo,
      message,
    }: {
      id: string;
      status?: string;
      assignedTo?: string | null;
      message?: string;
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status !== undefined) updates.status = status;
      if (assignedTo !== undefined) updates.assigned_to = assignedTo;
      if (message !== undefined) updates.message = message;
      const { error } = await supabase.from("lead").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["leads"] }),
  });
}
