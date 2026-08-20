import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { dateFmt } from "@/lib/format";
import { cn } from "@/lib/utils";

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
        .select("id, subject, body, created_at, read_at")
        .eq("user_account_id", accountId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const notifications = notificationQuery.data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;

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
        <div className="border-b border-border px-4 py-3 font-display text-sm font-semibold">
          Notifications
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
                className="flex gap-3 border-b border-border/60 px-4 py-3 last:border-0"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.read_at ? "bg-muted-foreground" : "bg-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{n.subject}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{dateFmt(n.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
