import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard, KpiCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyEarnings } from "@/data/deals";
import { useSaveUserSettings, useUserSettings } from "@/data/user-settings";
import { useAuth } from "@/lib/auth";
import { zarCompact } from "@/lib/format";

export const Route = createFileRoute("/settings/financials")({
  head: () => ({ meta: [{ title: "Financial Goals | Dream Supreme Properties" }] }),
  component: FinancialsPage,
});

function FinancialsPage() {
  const { isReadOnly } = useAuth();
  const settings = useUserSettings();
  const save = useSaveUserSettings();
  const earnings = useMyEarnings();
  const [mandates, setMandates] = useState(0);
  const [sales, setSales] = useState(0);
  const [gci, setGci] = useState(0);
  useEffect(() => {
    if (settings.data) {
      setMandates(settings.data.mandateTarget);
      setSales(settings.data.salesTargetCents / 100);
      setGci(settings.data.gciTargetCents / 100);
    }
  }, [settings.data]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to edit targets.");
    if (!settings.data) return;
    try {
      await save.mutateAsync({
        ...settings.data,
        mandateTarget: mandates,
        salesTargetCents: Math.round(sales * 100),
        gciTargetCents: Math.round(gci * 100),
      });
      toast.success("Performance targets saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save targets");
    }
  }
  return (
    <AppShell title="Settings" description="Live earnings and persisted personal targets.">
      <SettingsTabs />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="YTD earnings"
          value={zarCompact(earnings.data?.ytdEarnings ?? 0)}
          icon={TrendingUp}
        />
        <KpiCard
          label="Pending pipeline"
          value={zarCompact(earnings.data?.pendingPipeline ?? 0)}
          icon={TrendingUp}
        />
        <KpiCard label="Deals YTD" value={earnings.data?.dealsYtd ?? 0} icon={Target} />
      </div>
      <GlassCard className="mt-6">
        <h2 className="font-display font-semibold">Performance targets</h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="mandates">Monthly mandates</Label>
            <Input
              id="mandates"
              type="number"
              min="0"
              value={mandates}
              disabled={isReadOnly}
              onChange={(event) => setMandates(Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="sales">Monthly sales value (R)</Label>
            <Input
              id="sales"
              type="number"
              min="0"
              value={sales}
              disabled={isReadOnly}
              onChange={(event) => setSales(Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="gci">Monthly GCI target (R)</Label>
            <Input
              id="gci"
              type="number"
              min="0"
              value={gci}
              disabled={isReadOnly}
              onChange={(event) => setGci(Number(event.target.value))}
            />
          </div>
          <div className="sm:col-span-3">
            <Button disabled={save.isPending || settings.isLoading || isReadOnly}>
              {isReadOnly ? "Read-Only Mode" : save.isPending ? "Saving…" : "Save targets"}
            </Button>
          </div>
        </form>
      </GlassCard>
    </AppShell>
  );
}
