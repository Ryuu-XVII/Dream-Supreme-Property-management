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

      if (error) {
        // Fallback for demo mode
        const { data: fallbackLease, error: fallbackError } = await supabase
          .from("lease")
          .insert([
            {
              agency_id: account.agencyId,
              property_id: payload.propertyId,
              landlord_party_id: payload.landlordPartyId,
              tenant_party_id: payload.tenantPartyId,
              managed_by: payload.managedBy || account.id,
              start_on: payload.startOn,
              end_on: payload.endOn,
              monthly_rent_cents: payload.monthlyRentCents,
              escalation_rate_bps: payload.escalationRateBps || 800,
              escalation_month: payload.escalationMonth || 1,
              deposit_cents: payload.depositCents || 0,
              deposit_held_by: payload.depositHeldBy || "agency_trust",
              procurement_fee_cents: payload.procurementFeeCents || 0,
              management_fee_bps: payload.managementFeeBps || 800,
              status: "active",
            },
          ])
          .select("id")
          .single();

        if (fallbackError) throw fallbackError;
        return fallbackLease.id;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leases"] });
      queryClient.invalidateQueries({ queryKey: ["trust-ledger"] });
    },
  });
}
