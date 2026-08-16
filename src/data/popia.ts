import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface PopiaPartyMatch {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  idOrRegNumber: string | null;
  documentCount: number;
  signatureCount: number;
  leadCount: number;
}

export function usePopiaLookup(search: string) {
  return useQuery({
    queryKey: ["popia-lookup", search],
    enabled: search.trim().length >= 2,
    queryFn: async (): Promise<PopiaPartyMatch[]> => {
      const { data, error } = await supabase.rpc("popia_lookup_party", { p_search: search.trim() });
      if (error) throw error;
      return (data ?? []) as PopiaPartyMatch[];
    },
  });
}

export function usePopiaExport() {
  return useMutation({
    mutationFn: async (partyId: string) => {
      const { data, error } = await supabase.rpc("popia_export_party_data", {
        p_party_id: partyId,
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });
}

export function usePopiaErase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partyId: string) => {
      const { data, error } = await supabase.rpc("popia_erase_party_data", { p_party_id: partyId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["popia-lookup"] });
    },
  });
}
