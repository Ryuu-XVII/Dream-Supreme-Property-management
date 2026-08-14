import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Search, Sun, Moon, Monitor, LogOut, Calculator, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { initials, zar, relative, dateFmt } from "@/lib/format";
import { useDealSearch } from "@/data/deals";
import { supabase } from "@/lib/supabase";
import { navItems } from "./sidebar";
import { cn } from "@/lib/utils";

import { FloatingCalculatorModal } from "@/components/calculators/floating-calculator-modal";

export function Header() {
  const [open, setOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useApp();
  const { activeAccount, isReadOnly, signOut } = useAuth();
  const dealSearch = useDealSearch(open);
  const deals = dealSearch.data ?? [];
  const queryClient = useQueryClient();
  const notificationQueryKey = useMemo(
    () => ["header-notifications", activeAccount?.id],
    [activeAccount?.id],
  );
  const notificationQuery = useQuery({
    queryKey: notificationQueryKey,
    enabled: !!activeAccount,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification")
        .select("id, subject, body, created_at, read_at")
        .eq("user_account_id", activeAccount!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const notifications = notificationQuery.data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Live Realtime Notification Listener
  useEffect(() => {
    if (!activeAccount?.id) return;

    const channel = supabase
      .channel(`user-notifications:${activeAccount.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification",
          filter: `user_account_id=eq.${activeAccount.id}`,
        },
        (payload) => {
          const newNotif = payload.new as any;
          toast.info(newNotif.subject || "New Deal Notification", {
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
  }, [activeAccount?.id, navigate, queryClient, notificationQueryKey]);

  const me = activeAccount
    ? { name: activeAccount.fullName, email: activeAccount.email }
    : { name: "Signed out", email: "" };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-white/20 bg-background/50 px-3 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 md:hidden">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-xs font-bold text-primary-foreground">
          DS
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        className="group glass-input ml-auto flex h-9 w-9 items-center justify-center gap-2 rounded-lg text-muted-foreground md:mr-auto md:ml-0 md:w-80 md:justify-start md:px-3"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden text-sm md:inline">Search deals, pages…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCalcOpen(true)}
          className="hidden gap-1.5 sm:inline-flex"
        >
          <Calculator className="size-4" /> Calculator
        </Button>
        {isReadOnly ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.info("Strict Read-Only Mode", {
                description: "You are currently inspecting an agent's portal in read-only mode.",
              })
            }
            className="gap-1.5 font-medium opacity-80"
          >
            <PlusCircle className="size-4" /> New Deal (Read-Only)
          </Button>
        ) : (
          <Button size="sm" asChild className="gap-1.5 font-medium">
            <Link to="/deals/new">
              <PlusCircle className="size-4" /> New Deal
            </Link>
          </Button>
        )}
      </div>

      <FloatingCalculatorModal open={calcOpen} onOpenChange={setCalcOpen} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Theme">
            {theme === "dark" ? (
              <Moon className="size-5" />
            ) : theme === "light" ? (
              <Sun className="size-5" />
            ) : (
              <Monitor className="size-5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTheme("light")}>
            <Sun className="size-4" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme("dark")}>
            <Moon className="size-4" /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme("system")}>
            <Monitor className="size-4" /> System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
            {notifications.map((n) => (
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
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full pl-1 pr-2 transition-colors hover:bg-accent">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                {initials(me.name)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{me.name}</p>
            <p className="text-xs font-normal text-muted-foreground">Dream Supreme Properties</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings/profile">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={"/commission/earnings" as any}>My earnings</Link>
          </DropdownMenuItem>
          {!isReadOnly && (
            <DropdownMenuItem asChild>
              <Link to={"/setup" as any}>Setup wizard</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isReadOnly}
            onSelect={() => {
              if (isReadOnly) return;
              void signOut();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search deals by reference or address, or jump to a page…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Deals">
            {deals.slice(0, 8).map((dl) => (
              <CommandItem
                key={dl.id}
                value={`${dl.ref} ${dl.property.address}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: "/deals/$dealId", params: { dealId: dl.id } });
                }}
              >
                <span className="font-mono text-xs">{dl.ref}</span>
                <span className="truncate text-muted-foreground">{dl.property.address}</span>
                <Badge variant="outline" className="ml-auto money text-[10px]">
                  {zar(dl.salePrice, { decimals: false })}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Pages">
            {navItems.map((item) => (
              <CommandItem
                key={item.to}
                value={item.label}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: item.to as any });
                }}
              >
                <item.icon className="size-4" /> {item.label}
              </CommandItem>
            ))}
            <CommandItem
              value="New deal"
              onSelect={() => {
                setOpen(false);
                navigate({ to: "/pipeline" as any });
              }}
            >
              Create new deal
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}

export { relative };
