import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Clock, Home, MapPin, ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/ui-kit";
import { StageBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { stageFromDb } from "@/lib/domain";
import type { Stage } from "@/types";

interface StatusRequest {
  dealId: string;
  reference: string;
  stage: string;
  address: string;
  suburb: string;
  expiresAt: string;
}

export const Route = createFileRoute("/conveyancer")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Conveyancer Status Update | Dream Supreme Properties" }] }),
  component: ConveyancerPage,
});

function ConveyancerPage() {
  const { token } = Route.useSearch();
  const [request, setRequest] = useState<StatusRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [date, setDate] = useState("");

  useEffect(() => {
    let active = true;
    async function loadRequest() {
      if (!token) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_status_request", { p_token: token });
      if (!active) return;
      if (error || !data) {
        setRequest(null);
      } else {
        setRequest(data as unknown as StatusRequest);
      }
      setLoading(false);
    }
    void loadRequest();
    return () => {
      active = false;
    };
  }, [token]);

  async function submit() {
    if (!token || !request || !date) {
      toast.error("Please select a valid lodgement date.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_conveyancer_status", {
        p_token: token,
        p_lodged_on: date,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSubmitted(true);
      setRequest(null);
      toast.success("Status update submitted");
    } finally {
      setSubmitting(false);
    }
  }

  const displayStage = request
    ? ((stageFromDb[request.stage] ?? "Conveyancing") as Stage)
    : "Conveyancing";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-8">
        <Link to="/" className="mx-auto flex max-w-2xl items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold">Dream Supreme Properties</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
        <h1 className="mb-1 text-xl font-semibold sm:text-2xl">Conveyancer Status Update</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          This secure, single-use link records a lodgement date against its assigned deal.
        </p>

        {loading && (
          <GlassCard className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full" />
          </GlassCard>
        )}

        {!loading && submitted && (
          <GlassCard className="border-success/30 bg-success/5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h2 className="mt-3 font-display text-lg font-semibold">
              Status updated successfully.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The agency has been notified. This link cannot be used again.
            </p>
          </GlassCard>
        )}

        {!loading && !submitted && !request && (
          <GlassCard className="bg-muted/30 text-center">
            <ShieldAlert className="mx-auto size-10 text-destructive" />
            <p className="mt-3 font-display text-lg font-semibold">Invalid or expired link</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This link is missing, expired, or has already been used. Contact the agency for a new
              link.
            </p>
          </GlassCard>
        )}

        {!loading && request && (
          <div className="space-y-5">
            <GlassCard>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Deal reference</dt>
                  <dd className="money font-semibold">{request.reference}</dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" /> Property
                  </dt>
                  <dd className="max-w-[65%] text-right font-medium">
                    {request.address}
                    {request.suburb ? `, ${request.suburb}` : ""}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Current stage</dt>
                  <dd>
                    <StageBadge stage={displayStage} large />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3.5" /> Link expires
                  </dt>
                  <dd className="font-medium">
                    {new Date(request.expiresAt).toLocaleString("en-ZA")}
                  </dd>
                </div>
              </dl>
            </GlassCard>
            <GlassCard>
              <Label htmlFor="lodgement">Lodgement date</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Date the documents were lodged at the Deeds Office.
              </p>
              <Input
                id="lodgement"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <Button
                size="lg"
                className="mt-4 w-full"
                disabled={!date || submitting}
                onClick={submit}
              >
                {submitting ? "Submitting…" : "Submit Update"}
              </Button>
            </GlassCard>
          </div>
        )}
      </main>
    </div>
  );
}
