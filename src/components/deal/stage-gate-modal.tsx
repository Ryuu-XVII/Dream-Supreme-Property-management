import { useState, useEffect } from "react";
import { STAGES } from "@/types";
import { stageToDb } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldAlert,
  ArrowRight,
  Landmark,
  ShieldCheck,
  Info,
} from "lucide-react";

interface StageGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: any;
  targetStage: string;
  gateError?: string;
  onSuccess: (nextStage: string) => void;
}

export function StageGateModal({
  open,
  onOpenChange,
  deal,
  targetStage,
  gateError,
  onSuccess,
}: StageGateModalProps) {
  const { activeAccount, account, isReadOnly } = useAuth();
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentError, setCurrentError] = useState(gateError || "");
  const [liveConditions, setLiveConditions] = useState<any[] | null>(null);

  const userRole = activeAccount?.role || account?.role;
  const isAdmin =
    userRole === "admin" || userRole === "admin_agent" || (userRole as string) === "admin & agent";

  useEffect(() => {
    if (open) {
      setCurrentError(gateError || "");
      setOverride(false);
      setReason("");

      if (deal?.id) {
        supabase
          .from("suspensive_condition")
          .select("id, condition_type, description, status, due_on")
          .eq("deal_id", deal.id)
          .then(({ data, error }) => {
            if (data && !error) {
              setLiveConditions(data);
            }
          });
      }
    }
  }, [open, gateError, deal?.id]);

  const isGateBlocked = Boolean(currentError);

  // Check conditions status
  const effectiveConditions = liveConditions ?? deal?.conditions ?? [];
  const pendingConditions = effectiveConditions.filter((c: any) => {
    const s = String(c.status || "").toLowerCase();
    return s === "open" || s === "pending" || s === "extended";
  });
  const hasPendingConditions = pendingConditions.length > 0;
  const isMovingPastConditions =
    targetStage === "Conveyancing" ||
    (stageToDb as Record<string, string>)[targetStage] === "conveyancing";

  const handleConfirmTransition = async () => {
    if (isReadOnly) {
      toast.info("Read-only mode: exit impersonation to advance stages.");
      return;
    }

    setSubmitting(true);
    try {
      const dbTargetStage = (stageToDb as Record<string, string>)[targetStage] || targetStage;
      const { error } = await supabase.rpc("transition_deal", {
        p_deal_id: deal.id,
        p_to_stage: dbTargetStage,
        p_reason: reason.trim() || null,
        p_override: override,
      });

      if (error) {
        const errorMsg = error.message.replace(/^GATE_FAILED:\s*/i, "");
        setCurrentError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success(`Deal advanced to ${targetStage}`);
      onSuccess(targetStage);
      setReason("");
      setOverride(false);
      setCurrentError("");
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || "Failed to advance deal stage";
      setCurrentError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            Advance to Stage: <Badge variant="secondary">{targetStage}</Badge>
          </DialogTitle>
          <DialogDescription>
            Review prerequisites and progress requirements before advancing deal{" "}
            <span className="font-mono font-semibold text-foreground">
              {deal?.reference || deal?.ref}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gate Error Alert */}
          {isGateBlocked && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-destructive">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1.5 flex-1">
                  <p className="font-semibold text-sm">Stage Gate Requirement Pending</p>
                  <p className="text-destructive/90">{currentError}</p>

                  {isMovingPastConditions && hasPendingConditions && (
                    <div className="mt-2 rounded-lg bg-background/50 p-2 text-foreground flex items-center gap-2 border border-destructive/20">
                      <Info className="size-4 text-primary shrink-0" />
                      <span>
                        Navigate to the <strong>Conditions</strong> tab to mark pending conditions
                        as <strong>Fulfilled</strong> or <strong>Waived</strong>.
                      </span>
                    </div>
                  )}

                  {/* Admin Override Checkbox */}
                  {isAdmin && (
                    <div className="mt-3 pt-2.5 border-t border-destructive/20 flex items-center space-x-2">
                      <Checkbox
                        id="stage-gate-override"
                        checked={override}
                        onCheckedChange={(checked) => setOverride(!!checked)}
                      />
                      <label
                        htmlFor="stage-gate-override"
                        className="text-xs font-semibold cursor-pointer text-destructive select-none flex items-center gap-1.5"
                      >
                        <ShieldCheck className="size-3.5" /> Force override stage gate (Admin only)
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Requirements Checklist Card */}
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" /> Stage Checklist Highlights
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="size-3.5" /> Signed Mandate & OTP Docs
                </span>
                {deal?.documents?.some((d: any) => d.category === "otp") ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    Uploaded
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 border-amber-500/30"
                  >
                    Pending OTP
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ShieldAlert className="size-3.5" /> Suspensive Conditions
                </span>
                {!hasPendingConditions ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    Fulfilled / Resolved
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 border-amber-500/30"
                  >
                    {pendingConditions.length} Pending
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Landmark className="size-3.5" /> Appointed Conveyancer
                </span>
                {deal?.conveyancer && deal.conveyancer !== "Not appointed" ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    Appointed
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 border-amber-500/30"
                  >
                    Not Appointed
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="stageNotes"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Transition Notes (Optional)
            </Label>
            <Textarea
              id="stageNotes"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. All suspensive conditions verified, proceeding to conveyancer..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={handleConfirmTransition}
            variant={override ? "destructive" : "default"}
            className="gap-1.5"
          >
            {submitting ? (
              "Advancing…"
            ) : override ? (
              <>
                <ShieldCheck className="size-4" /> Force Advance Stage
              </>
            ) : (
              <>
                Confirm Advance <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
