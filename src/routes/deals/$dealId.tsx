import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { StageBadge, StatusDot } from "@/components/badges";
import { STAGES, type Stage } from "@/types";
import { zar, urgencyOf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DealOverviewTab } from "@/components/deal/overview";
import { DealConditionsTab } from "@/components/deal/conditions";
import { DealDocumentsTab } from "@/components/deal/documents";
import { DealCommissionTab } from "@/components/deal/commission";
import { DealOffersTab } from "@/components/deal/offers";
import { DealTimelineTab } from "@/components/deal/timeline";
import { DealBondsTab } from "@/components/deal/bonds";
import { ProgressNoteModal } from "@/components/deal/progress-note-modal";
import { StageGateModal } from "@/components/deal/stage-gate-modal";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  XCircle,
  CheckCircle2,
  Link2,
  MessageSquarePlus,
} from "lucide-react";
import { useDealDetail } from "@/data/deals";
import { stageToDb, stageFromDb } from "@/lib/domain";

export const Route = createFileRoute("/deals/$dealId")({
  component: DealDetailPage,
});

function DealDetailPage() {
  const { dealId } = Route.useParams();

  const { data: initialDeal, isLoading, error } = useDealDetail(dealId);
  const [deal, setDeal] = useState<any>(null);

  useEffect(() => {
    if (initialDeal) {
      setDeal(initialDeal);
    }
  }, [initialDeal]);

  const [activeTab, setActiveTab] = useState("overview");

  // Advance / Revert stage state
  const [stageModal, setStageModal] = useState<"advance" | "revert" | "cancel" | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [stageReason, setStageReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [stageOverride, setStageOverride] = useState(false);
  const [gateError, setGateError] = useState("");

  if (error) {
    return (
      <AppShell>
        <div className="p-8 text-center text-destructive">
          Error loading deal: {(error as Error).message}
        </div>
      </AppShell>
    );
  }

  if (isLoading || !deal) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Loading deal details...</div>
      </AppShell>
    );
  }

  const property = deal.property ?? { address: "Address not available", suburb: "", city: "" };

  const humanStage = STAGES.includes(deal.stage)
    ? deal.stage
    : stageFromDb[deal.stage] || "Mandate Signed";
  const currentStageIdx = STAGES.findIndex((s) => s === humanStage);

  const handleAdvanceStage = async () => {
    if (currentStageIdx >= STAGES.length - 1) return;
    const nextStage = STAGES[currentStageIdx + 1];
    try {
      toast.loading("Advancing stage...");
      const { error } = await supabase.rpc("transition_deal", {
        p_deal_id: dealId,
        p_to_stage: stageToDb[nextStage],
        p_reason: stageReason || null,
        p_override: stageOverride,
      });
      if (error) {
        if (error.message.includes("GATE_FAILED")) {
          setGateError(error.message.replace("GATE_FAILED: ", ""));
          toast.dismiss();
          return; // leave modal open
        }
        throw error;
      }
      setDeal((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          stage: nextStage,
          timeline: [
            {
              id: `h_${Date.now()}`,
              at: new Date().toISOString(),
              from_stage: prev.stage,
              to_stage: stageToDb[nextStage],
              actor: "Current User",
              action: `Advanced stage to ${nextStage}`,
              reason: stageReason || "Stage advanced",
            },
            ...prev.timeline,
          ],
        };
      });
      toast.dismiss();
      toast.success(`Deal advanced to ${nextStage}`);
      setStageModal(null);
      setStageReason("");
      setStageOverride(false);
      setGateError("");
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Failed: ${err.message}`);
    }
  };

  const handleRevertStage = async () => {
    if (currentStageIdx <= 0) return;
    const prevStage = STAGES[currentStageIdx - 1];
    try {
      toast.loading("Reverting stage...");
      if (!stageReason.trim()) {
        toast.error("A reason is required when reverting a stage.");
        return;
      }
      const { error } = await supabase.rpc("transition_deal", {
        p_deal_id: dealId,
        p_to_stage: stageToDb[prevStage],
        p_reason: stageReason,
        p_override: false,
      });
      if (error) throw error;
      setDeal((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          stage: prevStage,
          timeline: [
            {
              id: `h_${Date.now()}`,
              at: new Date().toISOString(),
              from_stage: prev.stage,
              to_stage: stageToDb[prevStage],
              actor: "Current User",
              action: `Reverted stage to ${prevStage}`,
              reason: stageReason || "Stage reverted",
            },
            ...prev.timeline,
          ],
        };
      });
      toast.dismiss();
      toast.success(`Deal reverted to ${prevStage}`);
      setStageModal(null);
      setStageReason("");
    } catch (err: any) {
      toast.dismiss();
      toast.error(`Failed: ${err.message}`);
    }
  };

  const handleCancelDeal = async () => {
    if (!cancelReason) {
      toast.error("Select a cancellation reason.");
      return;
    }
    if (cancelReason === "other" && !stageReason.trim()) {
      toast.error("Enter notes when selecting Other.");
      return;
    }
    const { error } = await supabase.rpc("cancel_deal", {
      p_deal_id: dealId,
      p_reason: cancelReason,
      p_notes: stageReason || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeal((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: "cancelled",
        cancellation_reason: cancelReason,
        cancelled_on: new Date().toISOString().split("T")[0],
        timeline: [
          {
            id: `h_${Date.now()}`,
            at: new Date().toISOString(),
            actor: "Current User",
            action: "Deal Cancelled",
            reason: `Deal cancelled: ${cancelReason || "No reason provided"}`,
          },
          ...prev.timeline,
        ],
      };
    });
    toast.error("Deal has been marked as Cancelled");
    setStageModal(null);
    setCancelReason("");
    setStageReason("");
  };

  const copyConveyancerLink = async () => {
    const email = deal.conveyancer?.email;
    if (!email) {
      toast.error("Add an email address to the appointed conveyancer firm first.");
      return;
    }
    const { data: token, error } = await supabase.rpc("create_status_request", {
      p_deal_id: dealId,
      p_recipient_email: email,
      p_expires_in_hours: 72,
    });
    if (error) return toast.error(error.message);
    const link = `${window.location.origin}/conveyancer?token=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(link);
    toast.success("Single-use conveyancer link copied", {
      description: `Send it to ${email}; it expires in 72 hours.`,
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/pipeline" className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="size-3.5" /> Back to Pipeline
              </Link>
              <span>/</span>
              <span>{deal.reference}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold tracking-tight">{deal.reference}</h1>
              <StageBadge stage={humanStage as any} />
              <StatusDot tone={deal.status === "cancelled" ? "lapsed" : "safe"} />
            </div>
            <p className="text-sm text-muted-foreground">
              {property?.address_line}, {property?.suburb}, {property?.city} —{" "}
              <span className="font-medium text-foreground">
                {zar(deal.sale_price_cents, { decimals: false })}
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {deal.status !== "cancelled" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setNoteModalOpen(true)}>
                  <MessageSquarePlus className="mr-1 size-4 text-primary" /> Log Note
                </Button>
                <Button variant="outline" size="sm" onClick={copyConveyancerLink}>
                  <Link2 className="mr-1 size-3.5" /> Conveyancer link
                </Button>
                {currentStageIdx > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setStageModal("revert")}>
                    <ChevronLeft className="mr-1 size-4" /> Revert Stage
                  </Button>
                )}
                {currentStageIdx < STAGES.length - 1 && (
                  <Button size="sm" onClick={() => setStageModal("advance")}>
                    Advance Stage <ChevronRight className="ml-1 size-4" />
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => setStageModal("cancel")}>
                  <XCircle className="mr-1 size-4" /> Cancel Deal
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stage Progress Stepper */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md">
          <div className="flex min-w-175 items-center justify-between">
            {STAGES.map((s, idx) => {
              const isPast = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              return (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                        isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : isPast
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="size-4" /> : idx + 1}
                    </div>
                    <span
                      className={`max-w-20 text-center text-[10px] leading-tight ${
                        isCurrent
                          ? "font-semibold text-foreground"
                          : isPast
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {s}
                    </span>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 w-8 sm:w-12 ${
                        idx < currentStageIdx ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="conditions">
              Conditions ({deal.conditions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="documents">Documents ({deal.documents?.length || 0})</TabsTrigger>
            <TabsTrigger value="bonds">Bonds</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
            <TabsTrigger value="offers">Offers ({deal.offers?.length || 0})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DealOverviewTab deal={deal} />
          </TabsContent>

          <TabsContent value="conditions">
            <DealConditionsTab deal={deal} />
          </TabsContent>

          <TabsContent value="documents">
            <DealDocumentsTab deal={deal} />
          </TabsContent>

          <TabsContent value="bonds">
            <DealBondsTab dealId={deal.id} />
          </TabsContent>

          <TabsContent value="commission">
            <DealCommissionTab deal={deal} />
          </TabsContent>

          <TabsContent value="offers">
            <DealOffersTab deal={deal} />
          </TabsContent>

          <TabsContent value="timeline">
            <DealTimelineTab deal={deal} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Advance Stage Modal */}
      <Dialog
        open={stageModal === "advance"}
        onOpenChange={(open) => {
          if (!open) {
            setStageModal(null);
            setGateError("");
            setStageOverride(false);
            setStageReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance Stage</DialogTitle>
            <DialogDescription>
              Advance deal <strong>{deal.ref}</strong> from{" "}
              <strong>{STAGES[currentStageIdx]}</strong> to{" "}
              <strong>{STAGES[currentStageIdx + 1]}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Note / Gate condition confirmation (optional)</Label>
            <Textarea
              placeholder="e.g. All suspensive conditions fulfilled, contract signed..."
              value={stageReason}
              onChange={(e) => setStageReason(e.target.value)}
            />
            {gateError && (
              <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-semibold mb-1">Stage Gate Blocked</p>
                <p>{gateError}</p>
                <div className="mt-3 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="override"
                    checked={stageOverride}
                    onChange={(e) => setStageOverride(e.target.checked)}
                    className="size-4 rounded border-destructive/50 text-destructive focus:ring-destructive"
                  />
                  <Label htmlFor="override" className="text-destructive font-medium cursor-pointer">
                    Force override (Admin only)
                  </Label>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStageModal(null);
                setGateError("");
                setStageOverride(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAdvanceStage}>Confirm Advance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Stage Modal */}
      <Dialog open={stageModal === "revert"} onOpenChange={() => setStageModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert Stage</DialogTitle>
            <DialogDescription>
              Revert deal <strong>{deal.ref}</strong> back to{" "}
              <strong>{STAGES[Math.max(0, currentStageIdx - 1)]}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason for reverting (required)</Label>
            <Textarea
              placeholder="e.g. Buyer submitted revised documentation..."
              value={stageReason}
              onChange={(e) => setStageReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageModal(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevertStage}>
              Confirm Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Deal Modal */}
      <Dialog open={stageModal === "cancel"} onOpenChange={() => setStageModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Deal</DialogTitle>
            <DialogDescription>
              Mark deal <strong>{deal.ref}</strong> as Cancelled. This will stop condition
              reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Cancellation Reason</Label>
            <Select value={cancelReason} onValueChange={setCancelReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bond_declined">Bond declined</SelectItem>
                <SelectItem value="bond_not_applied_in_time">Bond not applied in time</SelectItem>
                <SelectItem value="sale_of_purchasers_property_failed">
                  Sale of purchaser property failed
                </SelectItem>
                <SelectItem value="purchaser_withdrew">Purchaser withdrew</SelectItem>
                <SelectItem value="seller_withdrew">Seller withdrew</SelectItem>
                <SelectItem value="property_defect">Property defect discovered</SelectItem>
                <SelectItem value="compliance_certificate_failure">
                  Compliance certificate failure
                </SelectItem>
                <SelectItem value="price_renegotiation_failed">
                  Price renegotiation failed
                </SelectItem>
                <SelectItem value="title_or_boundary_defect">Title or boundary defect</SelectItem>
                <SelectItem value="municipal_or_clearance_obstruction">
                  Municipal or clearance obstruction
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Label>Notes {cancelReason === "other" ? "(required)" : "(optional)"}</Label>
            <Textarea
              placeholder="Add cancellation context for the audit trail"
              value={stageReason}
              onChange={(event) => setStageReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageModal(null)}>
              Keep Deal Active
            </Button>
            <Button variant="destructive" onClick={handleCancelDeal}>
              Cancel Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Note Modal */}
      <ProgressNoteModal
        open={noteModalOpen}
        onOpenChange={setNoteModalOpen}
        dealId={deal.id}
        dealRef={deal.reference || deal.ref || "Deal"}
        onSuccess={(newEntry) => {
          setDeal((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              timeline: [newEntry, ...(prev.timeline || [])],
            };
          });
        }}
      />

      {/* Stage Gate Helper Modal */}
      {stageModal === "advance" && currentStageIdx < STAGES.length - 1 && (
        <StageGateModal
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setStageModal(null);
              setGateError("");
            }
          }}
          deal={deal}
          targetStage={STAGES[currentStageIdx + 1]}
          gateError={gateError}
          onSuccess={(nextStage) => {
            setDeal((prev: any) => {
              if (!prev) return prev;
              return {
                ...prev,
                stage: nextStage,
                timeline: [
                  {
                    id: `h_${Date.now()}`,
                    at: new Date().toISOString(),
                    from_stage: prev.stage,
                    to_stage: (stageToDb as Record<string, string>)[nextStage] || nextStage,
                    actor: "Current User",
                    action: `Advanced stage to ${nextStage}`,
                    reason: "Stage advanced via Stage Gate Checkpoint",
                  },
                  ...(prev.timeline || []),
                ],
              };
            });
            setStageModal(null);
            setGateError("");
          }}
        />
      )}
    </AppShell>
  );
}
