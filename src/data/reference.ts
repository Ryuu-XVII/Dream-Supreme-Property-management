import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_account")
        .select("id, full_name")
        .eq("role", "agent");
      if (error) throw error;
      return data;
    },
  });
}
