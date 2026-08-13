import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserSettings, useSaveUserSettings } from "@/data/user-settings";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/settings/preferences")({
  head: () => ({ meta: [{ title: "Deal Presets | Dream Supreme Properties" }] }),
  component: PreferencesPage,
});

function PreferencesPage() {
  const { isReadOnly } = useAuth();
  const settings = useUserSettings();
  const save = useSaveUserSettings();
  const firms = useQuery({
    queryKey: ["conveyancer-firms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conveyancer_firm")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [rate, setRate] = useState(500);
  const [firmId, setFirmId] = useState<string | null>(null);
  useEffect(() => {
    if (settings.data) {
      setRate(settings.data.defaultCommissionRateBps);
      setFirmId(settings.data.defaultConveyancerFirmId);
    }
  }, [settings.data]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to edit presets.");
    if (!settings.data) return;
    try {
      await save.mutateAsync({
        ...settings.data,
        defaultCommissionRateBps: rate,
        defaultConveyancerFirmId: firmId,
      });
      toast.success("Deal presets saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save presets");
    }
  }
  return (
    <AppShell title="Settings" description="Manage persisted defaults for new deals.">
      <SettingsTabs />
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="flex items-center gap-2 font-display font-semibold">
            <FileCheck className="size-4 text-primary" /> Deal presets
          </h2>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="rate">Default commission rate (%)</Label>
              <Input
                id="rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={rate / 100}
                onChange={(event) => setRate(Math.round(Number(event.target.value) * 100))}
              />
            </div>
            <div>
              <Label>Preferred conveyancer</Label>
              <Select
                value={firmId ?? "none"}
                onValueChange={(value) => setFirmId(value === "none" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {(firms.data ?? []).map((firm) => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={save.isPending || settings.isLoading || isReadOnly}>
              {isReadOnly ? "Read-Only Mode" : save.isPending ? "Saving…" : "Save presets"}
            </Button>
          </form>
        </GlassCard>
        <GlassCard className="border-warning/30">
          <h2 className="flex items-center gap-2 font-display font-semibold">
            <ShieldAlert className="size-4 text-warning" /> Electronic signature
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Saved signature stamps are disabled until the secure server-side signing workflow is
            available. This prevents an unverified image or typed name from being presented as a
            legally executed signature.
          </p>
        </GlassCard>
      </div>
    </AppShell>
  );
}
