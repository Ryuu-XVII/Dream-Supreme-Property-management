import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { dateFmt } from "@/lib/format";
import { cn } from "@/lib/utils";

// A short two-tone chime synthesized with the Web Audio API rather than a
// shipped audio file, so there's nothing to load and no CORS/asset-path
// concerns. Browsers block audio until the user has interacted with the page
// at least once, so failures here (before that first interaction) are
// expected and silently ignored — the toast/visual badge still lands.
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;
      const start = now + i * 0.1;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // Ignored — autoplay restrictions or missing Web Audio support.
  }
}

// Shared by both the agent portal header (src/components/layout/header.tsx)
// and the admin portal header (src/components/admin/admin-header.tsx), which
// previously had no notification UI at all despite the backend generating
// notifications for admins. `accountId` is passed explicitly rather than
// read from useAuth() here so each caller can decide whether impersonation
// should affect which account's notifications are shown.
export function NotificationBell({ accountId }: { accountId: string | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationQueryKey = useMemo(() => ["header-notifications", accountId], [accountId]);

  const notificationQuery = useQuery({
    queryKey: notificationQueryKey,
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification")
        .select("id, subject, body, link, created_at, read_at")
        .eq("user_account_id", accountId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const notifications = notificationQuery.data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;

  const markRead = (ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    queryClient.setQueryData(notificationQueryKey, (prev: typeof notifications | undefined) =>
      (prev ?? []).map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)),
    );
    void supabase.from("notification").update({ read_at: now }).in("id", ids);
  };

  const openNotification = (n: (typeof notifications)[number]) => {
    if (!n.read_at) markRead([n.id]);
    if (n.link) navigate({ to: n.link as any });
  };

  const clearNotifications = (ids: string[]) => {
    if (ids.length === 0) return;
    queryClient.setQueryData(notificationQueryKey, (prev: typeof notifications | undefined) =>
      (prev ?? []).filter((n) => !ids.includes(n.id)),
    );
    void supabase.from("notification").delete().in("id", ids);
  };

  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`user-notifications:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification",
          filter: `user_account_id=eq.${accountId}`,
        },
        (payload) => {
          const newNotif = payload.new as any;
          playChime();
          toast.info(newNotif.subject || "New notification", {
            description: newNotif.body,
            action: newNotif.link
              ? {
                  label: "View",
                  onClick: () => navigate({ to: newNotif.link }),
                }
              : undefined,
          });
          queryClient.setQueryData(
            notificationQueryKey,
            (prev: typeof notifications | undefined) => {
              const next = [
                {
                  id: newNotif.id,
                  subject: newNotif.subject,
                  body: newNotif.body,
                  link: newNotif.link ?? null,
                  created_at: newNotif.created_at,
                  read_at: newNotif.read_at ?? null,
                },
                ...(prev ?? []),
              ];
              return next.slice(0, 20);
            },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, navigate, queryClient, notificationQueryKey]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-destructive font-mono text-[9px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead(notifications.filter((n) => !n.read_at).map((n) => n.id))}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => clearNotifications(notifications.map((n) => n.id))}
                className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="group flex gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className="flex min-w-0 flex-1 gap-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read_at ? "bg-muted-foreground/40" : "bg-primary",
                    )}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "line-clamp-2 text-sm",
                        n.read_at ? "font-medium text-muted-foreground" : "font-semibold",
                      )}
                    >
                      {n.subject}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {dateFmt(n.created_at)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => clearNotifications([n.id])}
                  aria-label="Clear notification"
                  className="mt-0.5 size-5 shrink-0 self-start rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                >
                  <X className="mx-auto size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
