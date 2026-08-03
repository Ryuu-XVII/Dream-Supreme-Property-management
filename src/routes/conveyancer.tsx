import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Home, MapPin } from "lucide-react";
import { GlassCard, useFakeLoad } from "@/components/ui-kit";
import { StageBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { deals, propertyById, STAGES } from "@/data/mock";

export const Route = createFileRoute("/conveyancer")({
  head: () => ({
    meta: [
      { title: "Conveyancer Status Update | Dream Supreme Properties" },
      {
        name: "description",
        content: "Submit a status update on a property transfer for Dream Supreme Properties.",
      },
      { property: "og:title", content: "Conveyancer Status Update | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Submit a status update on a property transfer for Dream Supreme Properties.",
      },
    ],
  }),
  component: ConveyancerPage,
});

type ViewState = "loading" | "form" | "success" | "expired";

const deal = deals.find((d) => d.stage === "Documents & Guarantees") ?? deals[0];
const property = propertyById(deal.propertyId);
const currentIdx = STAGES.indexOf(deal.stage);
const nextStage = STAGES[Math.min(currentIdx + 1, STAGES.length - 1)];

function ConveyancerPage() {
  const loading = useFakeLoad(800);
  const [state, setState] = useState<ViewState>("loading");
  const [date, setDate] = useState("");

  const view: ViewState = loading ? "loading" : state === "loading" ? "form" : state;

  function submit() {
    if (!date) {
      toast.error("Please select a date");
      return;
    }
    setState("success");
    toast.success("Status update submitted");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold">Dream Supreme Properties</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
        <h1 className="mb-1 text-xl font-semibold sm:text-2xl">Conveyancer Status Update</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Please confirm progress on this transfer. No login required — this link is unique to this
          deal.
        </p>

        {view === "loading" && (
          <GlassCard className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-24 w-full" />
          </GlassCard>
        )}

        {view === "form" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <GlassCard>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Deal reference</dt>
                  <dd className="money font-semibold">{deal.ref}</dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" /> Property
                  </dt>
                  <dd className="max-w-[65%] text-right font-medium">
                    {property.address}, {property.suburb}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Current stage</dt>
                  <dd>
                    <StageBadge stage={deal.stage} large />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3.5" /> Next expected stage
                  </dt>
                  <dd className="font-medium">{nextStage}</dd>
                </div>
              </dl>
            </GlassCard>

            <GlassCard>
              <Label htmlFor="lodgement" className="text-sm font-medium">
                Lodgement Date
              </Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Date the documents were, or are expected to be, lodged at the Deeds Office.
              </p>
              <Input
                id="lodgement"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Button size="lg" className="mt-4 w-full" onClick={submit}>
                Submit Update
              </Button>
            </GlassCard>
          </motion.div>
        )}

        {view === "success" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="border-success/30 bg-success/5 text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" />
              <h2 className="mt-3 font-display text-lg font-semibold">
                Status updated successfully.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Thank you. The agency has been notified of the new lodgement date.
              </p>
            </GlassCard>
          </motion.div>
        )}

        {view === "expired" && (
          <GlassCard className="bg-muted/30 text-center text-muted-foreground">
            <p className="font-display text-lg font-semibold text-foreground">
              This link has expired.
            </p>
            <p className="mt-1 text-sm">Please contact the agency for a new link.</p>
          </GlassCard>
        )}

        {!loading && (
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-4 text-xs text-muted-foreground">
            <span>Demo:</span>
            <Button size="sm" variant="outline" onClick={() => setState("form")}>
              Form
            </Button>
            <Button size="sm" variant="outline" onClick={() => setState("success")}>
              Success
            </Button>
            <Button size="sm" variant="outline" onClick={() => setState("expired")}>
              Expired
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
