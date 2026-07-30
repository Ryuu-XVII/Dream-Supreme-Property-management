import { useState } from "react";
import { GlassCard } from "@/components/ui-kit";
import { usePipelineDeals, type PipelineDeal } from "@/data/deals";
import { FileText, ArrowRight, Eye, History, Loader2 } from "lucide-react";
import { dateFmt, dateTimeFmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export function AdminDealsPipeline() {
  const [inspectingDeal, setInspectingDeal] = useState<PipelineDeal | null>(null);
  const { data: deals = [], isLoading } = usePipelineDeals();

  // We'll show a simplified pipeline progression for active deals
  // We can group deals by stage, or just list the active ones with a timeline stepper

  const activeDeals = deals.filter(
    (d) => d.stage !== "Registered" && d.stage !== "Commission Released",
  );

  if (isLoading) {
    return (
      <GlassCard className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </GlassCard>
    );
  }

  if (activeDeals.length === 0) {
    return (
      <GlassCard>
        <h3 className="font-display text-base font-semibold mb-4">Deals Pipeline</h3>
        <p className="text-sm text-muted-foreground">No active deals in the pipeline.</p>
      </GlassCard>
    );
  }

  // Simplified stages for visualization
  const pipelineStages = [
    "Mandate Signed",
    "OTP Signed",
    "Conditions Pending",
    "Conveyancer Instructed",
    "Registered",
  ];

  return (
    <>
      <GlassCard className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-base font-semibold">Active Deals Pipeline</h3>
          <span className="text-xs font-medium px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-500/20">
            Read-only View
          </span>
        </div>

        <div className="space-y-6 flex-1">
          {activeDeals.map((deal) => {
            // Find the best matching simplified stage
            let currentStageIdx = 0;
            if (deal.stage === "OTP Signed") currentStageIdx = 1;
            else if (deal.stage === "Conditions Pending" || deal.stage === "Offer Received")
              currentStageIdx = 2;
            else if (
              deal.stage === "Conveyancer Instructed" ||
              deal.stage === "Compliance Certs" ||
              deal.stage === "Lodged"
            )
              currentStageIdx = 3;
            else if (deal.stage === "Registered") currentStageIdx = 4;

            return (
              <div
                key={deal.id}
                className="border border-border/50 rounded-lg p-4 bg-background/30 group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="size-4 text-indigo-500" />
                      <span className="font-mono text-xs font-medium">{deal.ref}</span>
                    </div>
                    <p
                      className="text-sm font-medium truncate max-w-[200px]"
                      title={deal.property?.address}
                    >
                      {deal.property?.address || "No Address"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm tabular-nums">
                      R {deal.salePrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {dateFmt(deal.stageSince)}
                    </p>
                  </div>
                </div>

                <div className="relative pt-2 pb-8">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 rounded-full" />
                  <div
                    className="absolute top-1/2 left-0 h-0.5 bg-indigo-500 -translate-y-1/2 transition-all duration-500 rounded-full"
                    style={{ width: `${(currentStageIdx / (pipelineStages.length - 1)) * 100}%` }}
                  />

                  <div className="relative flex justify-between">
                    {pipelineStages.map((stage, idx) => {
                      const isCompleted = idx <= currentStageIdx;
                      const isCurrent = idx === currentStageIdx;
                      const isFirst = idx === 0;
                      const isLast = idx === pipelineStages.length - 1;

                      return (
                        <div key={stage} className="relative flex flex-col items-center">
                          <div
                            className={cn(
                              "size-3 rounded-full border-2 bg-background z-10 transition-colors",
                              isCompleted
                                ? "border-indigo-500 bg-indigo-500"
                                : "border-slate-300 dark:border-slate-700",
                              isCurrent && "ring-4 ring-indigo-500/20",
                            )}
                          />
                          <span
                            className={cn(
                              "text-[10px] mt-2 font-medium absolute top-4 w-20 sm:w-24",
                              isFirst
                                ? "left-0 text-left"
                                : isLast
                                  ? "right-0 text-right"
                                  : "left-1/2 -translate-x-1/2 text-center",
                              isCurrent
                                ? "text-foreground"
                                : "text-muted-foreground opacity-70 hidden sm:block",
                            )}
                          >
                            {stage}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-6 pt-3 border-t border-border/30 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {deal.stage}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setInspectingDeal(deal)}
                  >
                    <Eye className="size-3" /> Inspect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <Sheet open={!!inspectingDeal} onOpenChange={(open) => !open && setInspectingDeal(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="size-5 text-indigo-500" />
              Deal Inspection
            </SheetTitle>
            <SheetDescription>Read-only view of {inspectingDeal?.ref} details.</SheetDescription>
          </SheetHeader>

          {inspectingDeal && (
            <div className="mt-8 space-y-6">
              <div className="space-y-4 rounded-lg border border-border p-4 bg-background/50">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reference</p>
                  <p className="font-mono text-sm font-medium">{inspectingDeal.ref}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Property</p>
                  <p className="text-sm font-medium">
                    {inspectingDeal.property?.address || "No Address"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Sale Value</p>
                  <p className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    R {inspectingDeal.salePrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Current Stage</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    {inspectingDeal.stage}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Updated At</p>
                  <p className="text-sm">{dateFmt(inspectingDeal.stageSince)}</p>
                </div>
              </div>

              <div>
                <h4 className="flex items-center gap-2 font-display text-sm font-semibold mb-4 border-b border-border pb-2">
                  <History className="size-4" /> Agent Details
                </h4>

                <div className="rounded-lg border border-border p-4 bg-background/50">
                  <p className="text-sm font-medium">
                    {inspectingDeal.agent?.name || "Unassigned"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Primary Agent</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
