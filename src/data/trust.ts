import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { TrustAccountType, TrustTransactionType } from "@/types";

export function useRecordTrustTransaction() {
  const queryClient = useQueryClient();
  const { account } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      dealId?: string;
      leaseId?: string;
      accountType: TrustAccountType;
      transactionType: TrustTransactionType;
      amountCents: number;
      referenceNumber: string;
      bankStatementDate: string;
      payerPayeeName: string;
      interestSplitClientPct?: number;
      interestSplitPpraPct?: number;
    }) => {
      if (!account?.agencyId) throw new Error("Missing agency context.");

      const { data, error } = await supabase.rpc("record_trust_transaction", {
        p_deal_id: payload.dealId || null,
        p_lease_id: payload.leaseId || null,
        p_account_type: payload.accountType,
        p_transaction_type: payload.transactionType,
        p_amount_cents: payload.amountCents,
        p_reference_number: payload.referenceNumber,
        p_bank_statement_date: payload.bankStatementDate,
        p_payer_payee_name: payload.payerPayeeName,
        p_interest_split_client_pct: payload.interestSplitClientPct ?? 95.0,
        p_interest_split_ppra_pct: payload.interestSplitPpraPct ?? 5.0,
      });

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trust-ledger"] });
    },
  });
}
