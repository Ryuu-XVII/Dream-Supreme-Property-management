import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

export const Route = createFileRoute("/conveyancer")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Conveyancer Status Update | Dream Supreme Properties" },
      { name: "description", content: "Submit a secure property-transfer status update." },
    ],
  }),
  component: ConveyancerPage,
});

function ConveyancerPage() {
  const { token } = Route.useSearch();
  const [date, setDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const request = useQuery({
    queryKey: ["conveyancer-status-request", token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_status_request", { p_token: token });
      if (error) throw error;
      if (!data) throw new Error("This status link is invalid, expired, or already used.");
      return data as {
        dealId: string;
        reference: string;
        stage: string;
        address: string;
        suburb: string;
        expiresAt: string;
      };
    },
  });
  const submitStatus = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Please select the actual lodgement date.");
      const { error } = await supabase.rpc("submit_conveyancer_status", {
        p_token: token,
        p_lodged_on: date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Status update submitted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Link
            to="/"
            className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
          >
            <Home className="size-4" />
          </Link>
          <span className="font-display text-sm font-semibold">Dream Supreme Properties</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
        <h1 className="mb-1 text-xl font-semibold sm:text-2xl">Conveyancer Status Update</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          This single-use link is scoped to one deal and expires automatically.
        </p>

        {!token || request.isError ? (
          <GlassCard className="text-center">
            <ShieldAlert className="mx-auto size-10 text-warning" />
            <h2 className="mt-3 font-display text-lg font-semibold">Link unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This link is invalid, expired, or already used. Please ask the agency for a new one.
            </p>
          </GlassCard>
        ) : request.isLoading ? (
          <GlassCard className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full" />
          </GlassCard>
        ) : submitted ? (
          <GlassCard className="border-success/30 bg-success/5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h2 className="mt-3 font-display text-lg font-semibold">Status updated successfully</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The lodgement date is recorded and the agency has been notified.
            </p>
          </GlassCard>
        ) : request.data ? (
          <div className="space-y-5">
            <GlassCard>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Deal reference</dt>
                  <dd className="money font-semibold">{request.data.reference}</dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" /> Property
                  </dt>
                  <dd className="max-w-[65%] text-right font-medium">
                    {request.data.address}, {request.data.suburb}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Current stage</dt>
                  <dd>
                    <StageBadge
                      stage={(stageFromDb[request.data.stage] || "Documents & Guarantees") as Stage}
                      large
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3.5" /> Link expires
                  </dt>
                  <dd>{new Date(request.data.expiresAt).toLocaleString("en-ZA")}</dd>
                </div>
              </dl>
            </GlassCard>
            <GlassCard>
              <Label htmlFor="lodgement">Actual Deeds Office lodgement date</Label>
              <Input
                id="lodgement"
                className="mt-2"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <Button
                size="lg"
                className="mt-4 w-full"
                disabled={submitStatus.isPending}
                onClick={() => submitStatus.mutate()}
              >
                {submitStatus.isPending ? "Submitting…" : "Submit one-time update"}
              </Button>
            </GlassCard>
          </div>
        ) : null}
      </main>
    </div>
  );
}
