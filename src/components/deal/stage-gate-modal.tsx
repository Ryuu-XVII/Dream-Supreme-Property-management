import { useState } from "react";
import { STAGES } from "@/types";
import { stageToDb } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
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
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldAlert,
  ArrowRight,
  Landmark,
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
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isGateBlocked = Boolean(gateError);

  const handleConfirmTransition = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("transition_deal", {
        p_deal_id: deal.id,
        p_to_stage: (stageToDb as Record<string, string>)[targetStage] || targetStage,
        p_reason: reason || null,
        p_override: override,
      });

      if (error) {
        if (error.message.includes("GATE_FAILED")) {
          toast.error(error.message.replace("GATE_FAILED: ", ""));
          return;
        }
        throw error;
      }

      toast.success(`Deal transitioned to ${targetStage}`);
      onSuccess(targetStage);
      setReason("");
      setOverride(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            Advance to Stage: <Badge variant="secondary">{targetStage}</Badge>
          </DialogTitle>
          <DialogDescription>
            Review prerequisites and progress requirements before advancing deal{" "}
            <span className="font-mono font-semibold text-foreground">{deal?.reference}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gate Error Alert */}
          {isGateBlocked && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-destructive">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-sm">Stage Gate Requirement Pending</p>
                  <p className="text-destructive/90">{gateError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Requirements Checklist Card */}
          <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" /> Stage Checklist Highlights
            </h4>

            <div className="space-y-2 text-xs">
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
                {deal?.conditions?.every(
                  (c: any) => c.status === "Fulfilled" || c.status === "Waived",
                ) ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    Fulfilled
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-600 border-amber-500/30"
                  >
                    {deal?.conditions?.filter(
                      (c: any) => c.status === "Open" || c.status === "Extended",
                    ).length || 0}{" "}
                    Pending
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Landmark className="size-3.5" /> Appointed Conveyancer
                </span>
                {deal?.conveyancer ? (
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
              placeholder="e.g. FICA documents verified, guarantees issued by bank..."
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
            className="gap-1.5"
          >
            {submitting ? "Transitioning…" : "Confirm Advance"} <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
