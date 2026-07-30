import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface BondApplication {
  id: string;
  dealId: string;
  institution: string;
  originator?: string;
  amountCents: number;
  status: "submitted" | "aip" | "granted" | "declined";
  appliedOn: string;
  updatedAt: string;
  createdAt: string;
}

export function useBonds(dealId?: string) {
  return useQuery({
    queryKey: ["bonds", "deal", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bond_application")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        dealId: row.deal_id,
        institution: row.institution,
        originator: row.originator,
        amountCents: row.amount_cents,
        status: row.status,
        appliedOn: row.applied_on,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      })) as BondApplication[];
    },
  });
}

export function useSaveBond() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<BondApplication> & { dealId: string }) => {
      const { id, dealId, institution, originator, amountCents, status, appliedOn } = payload;
      const { data, error } = await supabase
        .from("bond_application")
        .upsert({
          ...(id ? { id } : {}),
          deal_id: dealId,
          institution,
          originator,
          amount_cents: amountCents,
          status: status || "submitted",
          applied_on: appliedOn,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      
      await supabase.rpc("log_audit_event", {
        p_entity_type: "bond_application",
        p_entity_id: data.id,
        p_action: id ? "Updated bond application" : "Created bond application",
        p_summary: `${id ? "Updated" : "Created"} ${institution} bond for ${amountCents / 100}`,
        p_after_json: data,
      });

      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["bonds", "deal", vars.dealId] });
    },
  });
}

export function useDeleteBond() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { error } = await supabase.from("bond_application").delete().eq("id", id);
      if (error) throw error;
      
      await supabase.rpc("log_audit_event", {
        p_entity_type: "bond_application",
        p_entity_id: id,
        p_action: "Deleted bond application",
        p_summary: `Deleted bond application`,
        p_after_json: null,
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["bonds", "deal", vars.dealId] });
    },
  });
}
