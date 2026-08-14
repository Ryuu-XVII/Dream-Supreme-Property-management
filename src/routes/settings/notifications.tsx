import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notification-events";

export const Route = createFileRoute("/settings/notifications")({
  head: () => ({ meta: [{ title: "Notification Preferences | Dream Supreme Properties" }] }),
  component: NotificationsPage,
});

const eventTypes = [...NOTIFICATION_EVENT_TYPES];
interface Preference {
  type: string;
  email: boolean;
  inApp: boolean;
}

function NotificationsPage() {
  const { account, isReadOnly } = useAuth();
  const [preferences, setPreferences] = useState<Preference[]>(
    eventTypes.map((type) => ({ type, email: true, inApp: true })),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!account) return setLoading(false);
      const { data, error } = await supabase
        .from("user_notification_preference")
        .select("event_type, email_enabled, in_app_enabled")
        .eq("user_id", account.id);
      if (!active) return;
      if (error) toast.error(error.message);
      else if (data?.length) {
        const stored = new Map(data.map((row: any) => [row.event_type, row]));
        setPreferences((current) =>
          current.map((item) => {
            const row: any = stored.get(item.type);
            return row ? { ...item, email: row.email_enabled, inApp: row.in_app_enabled } : item;
          }),
        );
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [account]);

  function update(type: string, patch: Partial<Preference>) {
    setPreferences((current) =>
      current.map((item) => (item.type === type ? { ...item, ...patch } : item)),
    );
  }

  async function save() {
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to edit preferences.");
    if (!account) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("user_notification_preference").upsert(
        preferences.map((item) => ({
          user_id: account.id,
          event_type: item.type,
          email_enabled: item.email,
          in_app_enabled: item.inApp,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,event_type" },
      );
      if (error) toast.error(error.message);
      else toast.success("Notification preferences saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Settings" description="Choose how you receive each notification.">
      <SettingsTabs />
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Bell className="size-4 text-primary" /> Notification channels
          </h2>
          <Button disabled={loading || saving || isReadOnly} onClick={() => void save()}>
            {isReadOnly ? "Read-Only Mode" : saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">In-app</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preferences.map((item) => (
              <TableRow key={item.type}>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <Switch
                      disabled={loading || isReadOnly}
                      checked={item.email}
                      onCheckedChange={(checked) => update(item.type, { email: checked })}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <Switch
                      disabled={loading || isReadOnly}
                      checked={item.inApp}
                      onCheckedChange={(checked) => update(item.type, { inApp: checked })}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </AppShell>
  );
}
