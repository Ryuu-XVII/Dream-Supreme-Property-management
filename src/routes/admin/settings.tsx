import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

type Action = "archive" | "deactivate" | "trash";
function AdminSettings() {
  const { account } = useAuth();
  const [loading, setLoading] = useState<Action | null>(null);
  async function run(action: Action) {
    if (!account) return;
    const prompts: Record<Action, string> = {
      archive: "Archive eligible old deals?",
      deactivate: "Deactivate eligible idle agents?",
      trash: "Permanently empty the recycle bin? This cannot be undone.",
    };
    if (!window.confirm(prompts[action])) return;
    setLoading(action);
    const rpc =
      action === "archive"
        ? "admin_archive_old_deals"
        : action === "deactivate"
          ? "admin_deactivate_idle_agents"
          : "admin_empty_recycle_bin";
    const { data, error } = await supabase.rpc(rpc, { p_agency_id: account.agencyId });
    setLoading(null);
    if (error) toast.error(error.message);
    else
      toast.success(
        action === "trash"
          ? `Recycle bin emptied: ${JSON.stringify(data)}`
          : `${data ?? 0} records updated`,
      );
  }
  return (
    <>
      <AdminPageHeader
        title="System Settings"
        description="Only deployed administrative operations are shown."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard>
          <Archive className="size-5 text-primary" />
          <h2 className="mt-3 font-display font-semibold">Archive old deals</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs the audited server-side archival policy.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={!!loading}
            onClick={() => void run("archive")}
          >
            {loading === "archive" ? "Running…" : "Archive eligible deals"}
          </Button>
        </GlassCard>
        <GlassCard>
          <UserMinus className="size-5 text-warning" />
          <h2 className="mt-3 font-display font-semibold">Deactivate idle agents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs the server-side inactivity policy for this agency.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={!!loading}
            onClick={() => void run("deactivate")}
          >
            {loading === "deactivate" ? "Running…" : "Deactivate eligible agents"}
          </Button>
        </GlassCard>
        <GlassCard className="border-destructive/30">
          <Trash2 className="size-5 text-destructive" />
          <h2 className="mt-3 font-display font-semibold">Empty recycle bin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently deletes already archived records according to database policy.
          </p>
          <Button
            className="mt-4"
            variant="destructive"
            disabled={!!loading}
            onClick={() => void run("trash")}
          >
            {loading === "trash" ? "Running…" : "Empty recycle bin"}
          </Button>
        </GlassCard>
      </div>
    </>
  );
}
