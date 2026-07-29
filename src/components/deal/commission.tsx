import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, ShieldAlert } from "lucide-react";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { AgentAvatar } from "@/components/badges";
import type { Deal } from "@/types";
import { zar } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DealCommissionTab({ deal }: { deal: Deal }) {
  const [calculating, setCalculating] = useState(false);
  const calculation = useQuery({
    queryKey: ["deal-commission", deal.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_calculation")
        .select(
          `
          id, status, calculated_at, gross_cents, vat_cents, net_cents,
          distributable_pool_cents, office_share_cents, agent_pool_cents,
          allocations:commission_allocation(
            id, allocation_type, external_payee_name, gross_allocation_cents,
            desk_fee_cents, advance_recovery_cents, net_payable_cents,
            user:user_account_id(id, full_name)
          )
        `,
        )
        .eq("deal_id", deal.id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const runCalculation = async () => {
    setCalculating(true);
    const { error } = await supabase.rpc("calculate_deal_commission", {
      p_deal_id: deal.id,
      p_rule_set_id: null,
    });
    setCalculating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Commission calculation saved with a full input snapshot.");
    await calculation.refetch();
  };

  const value = calculation.data;
  const steps = value
    ? [
        ["Gross commission", value.gross_cents],
        ["VAT", -value.vat_cents],
        ["VAT-exclusive commission", value.net_cents],
        ["Distributable pool", value.distributable_pool_cents],
        ["Office share", -value.office_share_cents],
        ["Agent pool", value.agent_pool_cents],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => void runCalculation()} disabled={calculating} className="gap-2">
          <Calculator className="size-4" />
          {calculating ? "Calculating…" : value ? "Recalculate" : "Calculate commission"}
        </Button>
      </div>

      <Alert>
        <ShieldAlert className="size-4" />
        <AlertTitle>Compliance enforced</AlertTitle>
        <AlertDescription>
          Calculation is blocked unless practitioner splits total 100% and every internal
          practitioner has a valid FFC.
        </AlertDescription>
      </Alert>

      {!value && !calculation.isLoading ? (
        <EmptyState
          title="No saved calculation"
          message="Run the commission calculation to create an auditable statement."
        />
      ) : (
        <>
          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold">Commission waterfall</h3>
              {value && <Badge variant="outline">{value.status}</Badge>}
            </div>
            <div className="space-y-2">
              {steps.map(([label, amount]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5"
                >
                  <span className="text-sm">{label}</span>
                  <span className={Number(amount) < 0 ? "money text-destructive" : "money"}>
                    {zar(Math.abs(Number(amount)))}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="mb-3 font-display text-base font-semibold">Practitioner allocations</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Practitioner</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Gross allocation</TableHead>
                    <TableHead className="text-right">Advance recovery</TableHead>
                    <TableHead className="text-right">Net payable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(value?.allocations || []).map((allocation: any) => {
                    const user = {
                      id: allocation.user?.id || allocation.id,
                      name:
                        allocation.user?.full_name ||
                        allocation.external_payee_name ||
                        "External payee",
                      colour: "#1f7a52",
                    };
                    return (
                      <TableRow key={allocation.id}>
                        <TableCell>
                          <AgentAvatar user={user as any} showName />
                        </TableCell>
                        <TableCell>{allocation.allocation_type}</TableCell>
                        <TableCell className="money text-right">
                          {zar(allocation.gross_allocation_cents)}
                        </TableCell>
                        <TableCell className="money text-right text-destructive">
                          {zar(allocation.advance_recovery_cents)}
                        </TableCell>
                        <TableCell className="money text-right font-semibold">
                          {zar(allocation.net_payable_cents)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
