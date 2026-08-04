import { GlassCard } from "@/components/ui-kit";
import { AgentAvatar } from "@/components/badges";
import { userById, commissionWaterfall, type Deal } from "@/data/mock";
import { zar, dateFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function DealCommissionTab({ deal }: { deal: Deal }) {
  const steps = commissionWaterfall(deal);
  const totalSplit = deal.practitioners.reduce((sum, p) => sum + p.splitPct, 0);
  const netPayable = steps[steps.length - 1].amount;

  const expiredFFC = deal.practitioners
    .map((p) => userById(p.userId))
    .filter((u) => !u.ffc || (u.ffc.expiry && new Date(u.ffc.expiry) < new Date()));

  return (
    <div className="space-y-5">
      {expiredFFC.length > 0 && (
        <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Fidelity Fund Certificate issue</AlertTitle>
          <AlertDescription>
            {expiredFFC.map((u) => u.name).join(", ")} — FFC is expired or missing. Commission
            payout should be withheld until resolved.
          </AlertDescription>
        </Alert>
      )}

      {totalSplit !== 100 && (
        <Alert className="border-warning/40 bg-warning/15 text-warning-foreground">
          <AlertTriangle className="size-4" />
          <AlertTitle>Reconciliation error</AlertTitle>
          <AlertDescription>
            Practitioner splits total {totalSplit}%, not 100%. Please correct the allocation before
            releasing commission.
          </AlertDescription>
        </Alert>
      )}

      <GlassCard>
        <h3 className="mb-4 font-display text-base font-semibold">Commission waterfall</h3>
        <div className="space-y-1.5">
          {steps.map((step, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5",
                step.kind === "subtotal" && "bg-muted/60 font-medium",
                step.kind === "final" && "bg-primary/10 font-semibold",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{step.label}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {step.formula}
                </p>
              </div>
              <span
                className={cn(
                  "money shrink-0 text-sm",
                  step.amount < 0 && "text-destructive",
                  step.kind === "final" && "text-base text-primary",
                )}
              >
                {step.amount < 0 ? "− " : ""}
                {zar(Math.abs(step.amount), { decimals: false })}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Practitioner allocation</h3>
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Practitioner</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Split</TableHead>
                <TableHead>FFC</TableHead>
                <TableHead className="text-right">Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deal.practitioners.map((p) => {
                const user = userById(p.userId);
                const expired =
                  !user.ffc || (user.ffc.expiry && new Date(user.ffc.expiry) < new Date());
                return (
                  <TableRow key={p.userId}>
                    <TableCell>
                      <AgentAvatar user={user} showName />
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.role}
                      {p.external && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          External
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.splitPct}%</TableCell>
                    <TableCell>
                      {expired ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/30 bg-destructive/10 text-destructive"
                        >
                          Expired/Missing
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 text-success"
                        >
                          Valid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="money text-right">
                      {zar(Math.round((netPayable * p.splitPct) / 100), { decimals: false })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
