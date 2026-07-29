import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard } from "@/components/ui-kit";
import { notificationTypes } from "@/data/state";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Preferences | Dream Supreme Properties" },
      {
        name: "description",
        content: "Configure email, in-app and recipient rules for every notification type.",
      },
      { property: "og:title", content: "Notification Preferences | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Configure email, in-app and recipient rules for every notification type.",
      },
    ],
  }),
  component: NotificationsPage,
});

const RECIPIENTS = ["Agent", "Principal", "Admin"] as const;
type Recipient = (typeof RECIPIENTS)[number];

interface Pref {
  type: string;
  email: boolean;
  inApp: boolean;
  recipients: Recipient[];
}

function defaultRecipients(type: string): Recipient[] {
  if (type.includes("FFC") || type.includes("Mandate")) return ["Agent", "Admin"];
  if (type.includes("Commission")) return ["Principal", "Admin"];
  if (type.includes("lead")) return ["Agent"];
  return ["Agent", "Principal"];
}

function RecipientPicker({
  value,
  onChange,
}: {
  value: Recipient[];
  onChange: (r: Recipient[]) => void;
}) {
  function toggle(r: Recipient) {
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-40 justify-between font-normal">
          <span className="flex flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              value.map((r) => (
                <Badge
                  key={r}
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary"
                >
                  {r}
                </Badge>
              ))
            )}
          </span>
          <ChevronDown className="ml-1 size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {RECIPIENTS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox checked={value.includes(r)} onCheckedChange={() => toggle(r)} />
              {r}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationsPage() {
  const { account } = useAuth();
  const [prefs, setPrefs] = useState<Pref[]>(
    notificationTypes.map((type) => ({
      type,
      email: true,
      inApp: true,
      recipients: defaultRecipients(type),
    })),
  );
  const preferenceQuery = useQuery({
    queryKey: ["notification-preferences", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_preference").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!preferenceQuery.data?.length) return;
    const stored = new Map(preferenceQuery.data.map((row: any) => [row.event_type, row]));
    setPrefs((current) =>
      current.map((preference) => {
        const row: any = stored.get(preference.type);
        if (!row) return preference;
        return {
          ...preference,
          email: row.email_enabled,
          inApp: row.in_app_enabled,
          recipients: row.recipient_roles.map(
            (role: string) => `${role.charAt(0).toUpperCase()}${role.slice(1)}` as Recipient,
          ),
        };
      }),
    );
  }, [preferenceQuery.data]);

  function update(type: string, patch: Partial<Pref>) {
    setPrefs((prev) => prev.map((p) => (p.type === type ? { ...p, ...patch } : p)));
  }

  async function save() {
    if (!account) return;
    const { error } = await supabase.from("notification_preference").upsert(
      prefs.map((preference) => ({
        agency_id: account.agencyId,
        event_type: preference.type,
        email_enabled: preference.email,
        in_app_enabled: preference.inApp,
        recipient_roles: preference.recipients.map((recipient) => recipient.toLowerCase()),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "agency_id,event_type" },
    );
    if (error) return toast.error(error.message);
    toast.success("Notification preferences saved", {
      description: `${prefs.length} notification types updated.`,
    });
  }

  return (
    <AppShell title="Settings" description="Choose how and who is notified for each event type.">
      <SettingsTabs />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <GlassCard>
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Bell className="size-4 shrink-0 text-primary" />
              <h2 className="truncate font-display text-lg font-semibold">Notification Matrix</h2>
            </div>
            <Button size="sm" onClick={save} className="shrink-0">
              Save Preferences
            </Button>
          </div>

          {/* Table view for wider screens */}
          <div className="hidden overflow-x-auto scrollbar-thin sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notification Type</TableHead>
                  <TableHead className="text-center">Email</TableHead>
                  <TableHead className="text-center">In-App</TableHead>
                  <TableHead>Recipients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prefs.map((p) => (
                  <TableRow key={p.type}>
                    <TableCell className="font-medium">{p.type}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={p.email}
                        onCheckedChange={(v) => update(p.type, { email: v })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={p.inApp}
                        onCheckedChange={(v) => update(p.type, { inApp: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <RecipientPicker
                        value={p.recipients}
                        onChange={(r) => update(p.type, { recipients: r })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Stacked cards for narrow screens */}
          <div className="space-y-3 sm:hidden">
            {prefs.map((p) => (
              <div key={p.type} className="rounded-lg border border-border p-3">
                <p className="mb-3 text-sm font-medium">{p.type}</p>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <Switch checked={p.email} onCheckedChange={(v) => update(p.type, { email: v })} />
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">In-App</span>
                  <Switch checked={p.inApp} onCheckedChange={(v) => update(p.type, { inApp: v })} />
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Recipients</span>
                  <RecipientPicker
                    value={p.recipients}
                    onChange={(r) => update(p.type, { recipients: r })}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </AppShell>
  );
}
