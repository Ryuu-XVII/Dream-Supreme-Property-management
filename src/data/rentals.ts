import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { LeaseOnboardingPayload } from "@/types";

export function useCreateLeaseOnboarding() {
  const queryClient = useQueryClient();
  const { account } = useAuth();

  return useMutation({
    mutationFn: async (payload: LeaseOnboardingPayload) => {
      if (!account?.agencyId) throw new Error("Missing agency context.");

      const { data, error } = await supabase.rpc("create_lease_onboarding", {
        p_payload: {
          propertyId: payload.propertyId,
          landlordPartyId: payload.landlordPartyId,
          tenantPartyId: payload.tenantPartyId,
          managedBy: payload.managedBy || account.id,
          monthlyRentCents: payload.monthlyRentCents,
          depositCents: payload.depositCents || 0,
          depositHeldBy: payload.depositHeldBy || "agency_trust",
          procurementFeeCents: payload.procurementFeeCents || 0,
          managementFeeBps: payload.managementFeeBps || 800,
          startOn: payload.startOn,
          endOn: payload.endOn,
          escalationRateBps: payload.escalationRateBps || 800,
          escalationMonth: payload.escalationMonth || 1,
          adminFeeCents: payload.adminFeeCents || 150000,
          proRataRentCents: payload.proRataRentCents || 0,
          inspectionDate: payload.inspectionDate || null,
        },
      });

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      queryClient.invalidateQueries({ queryKey: ["trust-ledger"] });
    },
  });
}
