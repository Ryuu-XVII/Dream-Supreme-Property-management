import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Globe, Loader2, RefreshCw, Unlink } from "lucide-react";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { relative } from "@/lib/format";
import { useAgentProperty24, useSetProperty24Url, useSyncProperty24 } from "@/data/property24";

/**
 * Property24 profile and live listings for one agent. Renders on the agent's
 * own settings profile page (no `userId`) and, for admins, on any agent in
 * the agency (`userId` supplied).
 */
export function AgentProperty24Listings({
  userId,
  canSync = true,
}: {
  userId?: string;
  canSync?: boolean;
}) {
  const { data, isLoading } = useAgentProperty24(userId);
  const sync = useSyncProperty24();
  const saveUrl = useSetProperty24Url();
  const [urlDraft, setUrlDraft] = useState("");

  // Saving the URL and syncing are one action from the user's point of view:
  // pasting a link and then having to press a second button to see anything is
  // exactly the confusion this replaced.
  const connectAndSync = async () => {
    if (!userId) return;
    try {
      await saveUrl.mutateAsync({ userId, url: urlDraft });
    } catch (error) {
      toast.error("Could not save the Property24 link", {
        description: error instanceof Error ? error.message : undefined,
      });
      return;
    }
    runSync();
  };

  // Clearing the URL also drops the cached listings and profile — the
  // clear_property24_data_on_unlink trigger handles that server-side, so the
  // browser only has to null the link.
  const disconnect = async () => {
    if (!userId) return;
    const count = data?.listings.length ?? 0;
    if (
      !confirm(
        `Remove this Property24 link?\n\n${count} synced listing${count === 1 ? "" : "s"} will be removed from the app. The Property24 profile itself is not affected, and you can reconnect at any time.`,
      )
    ) {
      return;
    }
    try {
      await saveUrl.mutateAsync({ userId, url: null });
      setUrlDraft("");
      toast.success("Property24 link removed");
    } catch (error) {
      toast.error("Could not remove the Property24 link", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const runSync = () => {
    toast.loading("Fetching listings from Property24…", { id: "p24-sync" });
    sync.mutate(
      { userAccountId: userId },
      {
        onSuccess: (result) => {
          // A suspected parser failure is not a success worth celebrating —
          // the cached listings were kept rather than wiped, and someone
          // needs to look at it.
          if (result.staleWarning) {
            toast.warning("Property24 returned no listings", {
              id: "p24-sync",
              description: result.staleWarning,
            });
            return;
          }
          toast.success(
            `Synced ${result.counts.total} listing${result.counts.total === 1 ? "" : "s"}`,
            {
              id: "p24-sync",
              description: `${result.counts.sale} for sale · ${result.counts.rent} to rent`,
            },
          );
        },
        onError: (error) => {
          toast.error("Property24 sync failed", { id: "p24-sync", description: error.message });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <GlassCard className="lg:col-span-3">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </GlassCard>
    );
  }

  // No URL captured yet. Previously this rendered nothing at all, which left
  // no way to connect a profile outside the admin Team screen — and no clue
  // that the feature existed. Offer the input here instead.
  if (!data?.profileUrl) {
    if (!canSync) return null;
    return (
      <GlassCard className="lg:col-span-3">
        <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold">
          <Globe className="size-4 text-primary" /> Property24 listings
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Paste a public Property24 agent profile link to show that agent&apos;s photo, bio and live
          sale/rental listings here.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            placeholder="https://www.property24.com/estate-agents/agency/agent-name/123456"
            className="font-mono text-xs"
          />
          <Button
            onClick={connectAndSync}
            disabled={!urlDraft.trim() || saveUrl.isPending || sync.isPending}
            className="shrink-0"
          >
            {saveUrl.isPending || sync.isPending ? "Connecting…" : "Connect & sync"}
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="lg:col-span-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {data.profile?.photoUrl && (
            <img
              src={data.profile.photoUrl}
              alt={data.profile.fullName ?? "Property24 profile photo"}
              className="size-14 shrink-0 rounded-xl object-cover"
            />
          )}
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <Globe className="size-4 text-primary" /> Property24 listings
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.profile?.agencyName ? `${data.profile.agencyName} · ` : ""}
              {data.syncedAt ? `Updated ${relative(data.syncedAt)}` : "Not synced yet"}
            </p>
            {data.profile?.bio && (
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                {data.profile.bio}
              </p>
            )}
            {data.profile?.areasServiced && data.profile.areasServiced.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.profile.areasServiced.map((area) => (
                  <Badge key={area} variant="outline" className="text-[10px]">
                    {area}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild className="text-xs">
            <a href={data.profileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 size-3" /> Profile
            </a>
          </Button>
          {canSync && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={runSync}
                disabled={sync.isPending}
                className="text-xs"
              >
                <RefreshCw className={`mr-1 size-3 ${sync.isPending ? "animate-spin" : ""}`} />
                {sync.isPending ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={saveUrl.isPending || sync.isPending}
                className="text-xs text-destructive hover:text-destructive"
              >
                <Unlink className="mr-1 size-3" />
                {saveUrl.isPending ? "Removing…" : "Remove"}
              </Button>
            </>
          )}
        </div>
      </div>

      {data.syncError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">Last sync failed:</strong> {data.syncError}
          </span>
        </div>
      )}
    </GlassCard>
  );
}
