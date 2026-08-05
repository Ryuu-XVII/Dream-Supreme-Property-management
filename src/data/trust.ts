import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { TrustLedgerEntry, TrustAccountType, TrustTransactionType } from "@/types";

export function useTrustLedger(dealId?: string, leaseId?: string) {
  const { account } = useAuth();

  return useQuery({
    queryKey: ["trust-ledger", account?.agencyId, dealId, leaseId],
    enabled: !!account && account.role === "admin",
    queryFn: async (): Promise<TrustLedgerEntry[]> => {
      let query = supabase
        .from("trust_account_ledger")
        .select("*")
        .eq("agency_id", account!.agencyId)
        .order("created_at", { ascending: false });

      if (dealId) {
        query = query.eq("deal_id", dealId);
      }
      if (leaseId) {
        query = query.eq("lease_id", leaseId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Failed to fetch trust ledger:", error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        agencyId: row.agency_id,
        dealId: row.deal_id,
        leaseId: row.lease_id,
        accountType: row.account_type as TrustAccountType,
        transactionType: row.transaction_type as TrustTransactionType,
        amountCents: Number(row.amount_cents),
        referenceNumber: row.reference_number,
        bankStatementDate: row.bank_statement_date,
        payerPayeeName: row.payer_payee_name,
        interestSplitClientPct: Number(row.interest_split_client_pct || 95.0),
        interestSplitPpraPct: Number(row.interest_split_ppra_pct || 5.0),
        approvedByPrincipal: row.approved_by_principal,
        approvedAt: row.approved_at,
        createdAt: row.created_at,
      }));
    },
  });
}

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

      if (error) {
        // Fallback for demo client-side insert if RPC is missing
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("trust_account_ledger")
          .insert([
            {
              agency_id: account.agencyId,
              deal_id: payload.dealId || null,
              lease_id: payload.leaseId || null,
              account_type: payload.accountType,
              transaction_type: payload.transactionType,
              amount_cents: payload.amountCents,
              reference_number: payload.referenceNumber,
              bank_statement_date: payload.bankStatementDate,
              payer_payee_name: payload.payerPayeeName,
              interest_split_client_pct: payload.interestSplitClientPct ?? 95.0,
              interest_split_ppra_pct: payload.interestSplitPpraPct ?? 5.0,
              approved_by_principal: account.id,
              approved_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trust-ledger"] });
    },
  });
}
