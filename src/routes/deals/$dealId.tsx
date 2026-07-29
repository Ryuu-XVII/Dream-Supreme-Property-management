import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { StageBadge, StatusDot } from "@/components/badges";
import { STAGES, propertyById, type Deal, type Stage } from "@/data/state";
import { zar, urgencyOf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DealOverviewTab } from "@/components/deal/overview";
import { DealConditionsTab } from "@/components/deal/conditions";
import { DealDocumentsTab } from "@/components/deal/documents";
import { DealCommissionTab } from "@/components/deal/commission";
import { DealOffersTab } from "@/components/deal/offers";
import { DealTimelineTab } from "@/components/deal/timeline";
import {
  ArrowLeft, ChevronRight, ChevronLeft, XCircle, CheckCircle2,
} from "lucide-react";
import { useDealDetail } from "@/data/deals";

export const Route = createFileRoute("/deals/$dealId")({
  component: DealDetailPage,
});

function DealDetailPage() {
  const { dealId } = Route.useParams();
  
  const { data: initialDeal, isLoading, error } = useDealDetail(dealId);
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    if (initialDeal) {
      setDeal(initialDeal as Deal);
    }
  }, [initialDeal]);

  const [activeTab, setActiveTab] = useState("overview");

  // Advance / Revert stage state
  const [stageModal, setStageModal] = useState<"advance" | "revert" | "cancel" | null>(null);
  const [stageReason, setStageReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  if (isLoading || !deal) {
    return <AppShell><div className="p-8 text-center text-muted-foreground">Loading deal details...</div></AppShell>;
  }

  if (error) {
    return <AppShell><div className="p-8 text-center text-destructive">Error loading deal: {(error as Error).message}</div></AppShell>;
  }

  // Fallback to propertyById from mock if property isn't fully embedded. We embedded it in the query though, but UI expects propertyById. 
  // Wait, propertyById throws an error if it doesn't find it. Let's just create a dummy property if it's not found in mock.
  let property;
  try {
    property = propertyById(deal.propertyId);
  } catch {
    property = { address: "Address not available", suburb: "", city: "" }; // Mock fallback
  }

  const currentStageIdx = STAGES.findIndex((s) => s === deal.stage);

  const handleAdvanceStage = () => {
    if (currentStageIdx >= STAGES.length - 1) return;
    const nextStage = STAGES[currentStageIdx + 1];
    setDeal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stage: nextStage,
        timeline: [
          {
            id: `h_${Date.now()}`,
            at: new Date().toISOString(),
            from: prev.stage,
            to: nextStage,
            actor: "Current User",
            action: `Advanced stage to ${nextStage}`,
            reason: stageReason || "Stage advanced",
          },
          ...prev.timeline,
        ],
      };
    });
    toast.success(`Deal advanced to ${nextStage}`);
    setStageModal(null);
    setStageReason("");
  };

  const handleRevertStage = () => {
    if (currentStageIdx <= 0) return;
    const prevStage = STAGES[currentStageIdx - 1];
    setDeal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stage: prevStage,
        timeline: [
          {
            id: `h_${Date.now()}`,
            at: new Date().toISOString(),
            from: prev.stage,
            to: prevStage,
            actor: "Current User",
            action: `Reverted stage to ${prevStage}`,
            reason: stageReason || "Stage reverted",
          },
          ...prev.timeline,
        ],
      };
    });
    toast.info(`Deal reverted to ${prevStage}`);
    setStageModal(null);
    setStageReason("");
  };

  const handleCancelDeal = () => {
    setDeal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cancelled: { reason: cancelReason || "Other", at: new Date().toISOString().split("T")[0] },
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
              <span>{deal.ref}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold tracking-tight">{deal.ref}</h1>
              <StageBadge stage={deal.stage} />
              <StatusDot tone={deal.cancelled ? "lapsed" : "safe"} />
            </div>
            <p className="text-sm text-muted-foreground">
              {property?.address}, {property?.suburb}, {property?.city} —{" "}
              <span className="font-medium text-foreground">{zar(deal.salePrice, { decimals: false })}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!deal.cancelled && (
              <>
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
          <div className="flex min-w-[700px] items-center justify-between">
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
                      className={`max-w-[80px] text-center text-[10px] leading-tight ${
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
                      className={`mx-1 h-[2px] w-8 sm:w-12 ${
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
              Conditions ({deal.conditions.length})
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents ({deal.documents.length})
            </TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
            <TabsTrigger value="offers">Offers ({deal.offers.length})</TabsTrigger>
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
      <Dialog open={stageModal === "advance"} onOpenChange={() => setStageModal(null)}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageModal(null)}>
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
              Mark deal <strong>{deal.ref}</strong> as Cancelled. This will stop condition reminders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Cancellation Reason</Label>
            <Select value={cancelReason} onValueChange={setCancelReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bond Declined">Bond Declined</SelectItem>
                <SelectItem value="Purchaser Withdrew">Purchaser Withdrew</SelectItem>
                <SelectItem value="Seller Withdrew">Seller Withdrew</SelectItem>
                <SelectItem value="Defects Discovered">Defects Discovered</SelectItem>
                <SelectItem value="Expired Suspensive Condition">
                  Expired Suspensive Condition
                </SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
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
    </AppShell>
  );
}
