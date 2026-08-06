import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export interface UserSettings {
  defaultCommissionRateBps: number;
  defaultConveyancerFirmId: string | null;
  mandateTarget: number;
  salesTargetCents: number;
  gciTargetCents: number;
}

const defaults: UserSettings = {
  defaultCommissionRateBps: 500,
  defaultConveyancerFirmId: null,
  mandateTarget: 0,
  salesTargetCents: 0,
  gciTargetCents: 0,
};

export function useUserSettings() {
  const { account } = useAuth();
  return useQuery({
    queryKey: ["user-settings", account?.id],
    enabled: !!account,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase
        .from("user_setting")
        .select("*")
        .eq("user_id", account!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return defaults;
      return {
        defaultCommissionRateBps: data.default_commission_rate_bps,
        defaultConveyancerFirmId: data.default_conveyancer_firm_id,
        mandateTarget: data.mandate_target,
        salesTargetCents: data.sales_target_cents,
        gciTargetCents: data.gci_target_cents,
      };
    },
  });
}

export function useSaveUserSettings() {
  const { account } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (settings: UserSettings) => {
      if (!account) throw new Error("Authentication required");
      const { error } = await supabase.from("user_setting").upsert({
        user_id: account.id,
        default_commission_rate_bps: settings.defaultCommissionRateBps,
        default_conveyancer_firm_id: settings.defaultConveyancerFirmId,
        mandate_target: settings.mandateTarget,
        sales_target_cents: settings.salesTargetCents,
        gci_target_cents: settings.gciTargetCents,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["user-settings", account?.id] }),
  });
}
