import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Search, Sun, Moon, Monitor, LogOut, PlusCircle, Calculator } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QuickDealModal } from "@/components/deal/quick-deal-modal";
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
import { deals, agency } from "@/data/state";
import { supabase } from "@/lib/supabase";
import { initials, zar, relative, dateFmt } from "@/lib/format";
import { propertyById } from "@/data/state";
import { navItems } from "./sidebar";
import { cn } from "@/lib/utils";

export function Header() {
  const [open, setOpen] = useState(false);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme, role, toggleCalculator } = useApp();
  const { account, signOut } = useAuth();
  const notificationQuery = useQuery({
    queryKey: ["notifications", account?.id],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification")
        .select("id, subject, body, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map((notification) => ({
        id: notification.id,
        title: notification.subject,
        body: notification.body,
        at: notification.created_at,
        unread: !notification.read_at,
        tone: notification.subject.toLowerCase().includes("overdue") ? "danger" : "info",
      }));
    },
  });
  const notifications = notificationQuery.data ?? [];
  const unread = notifications.filter((n) => n.unread).length;

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

  const me = { name: account?.fullName ?? "Agent User", role };

  const handleSignOut = async () => {
    await signOut();
    await navigate({ to: "/login", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3 md:hidden">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-display text-xs font-bold text-primary-foreground">
          DS
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        className="group ml-auto flex h-9 w-9 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent md:mr-auto md:ml-0 md:w-80 md:justify-start md:px-3"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden text-sm md:inline">Search deals, pages…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>

      <div className="hidden items-center gap-2 lg:flex">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => toggleCalculator(true)}
        >
          <Calculator className="size-3.5 text-primary" /> Calculator
        </Button>
        <Button
          size="sm"
          className="gap-1.5 text-xs font-semibold shadow-sm"
          onClick={() => setQuickModalOpen(true)}
        >
          <PlusCircle className="size-3.5" /> + New Deal
        </Button>
      </div>

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

      <Popover
        onOpenChange={(nextOpen) => {
          if (!nextOpen || unread === 0) return;
          void supabase
            .from("notification")
            .update({ read_at: new Date().toISOString() })
            .is("read_at", null)
            .then(() => notificationQuery.refetch());
        }}
      >
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
                    n.tone === "danger" && "bg-destructive",
                    n.tone === "warning" && "bg-warning",
                    n.tone === "success" && "bg-success",
                    n.tone === "info" && "bg-info",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{dateFmt(n.at)}</p>
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
            <p className="text-xs font-normal text-muted-foreground">{agency.name}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {["Principal", "Admin"].includes(role) && (
            <DropdownMenuItem asChild>
              <Link to="/admin">Admin Dashboard</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/settings/profile">My profile</Link>
          </DropdownMenuItem>
          {["Principal", "Admin"].includes(role) && (
            <DropdownMenuItem asChild>
              <Link to="/admin/agency">Agency settings</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/commission/earnings">My earnings</Link>
          </DropdownMenuItem>
          {["Principal", "Admin"].includes(role) && (
            <DropdownMenuItem asChild>
              <Link to="/register">Agent Registration</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void handleSignOut()}>
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
                value={`${dl.ref} ${propertyById(dl.propertyId).address}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: "/deals/$dealId", params: { dealId: dl.id } });
                }}
              >
                <span className="font-mono text-xs">{dl.ref}</span>
                <span className="truncate text-muted-foreground">
                  {propertyById(dl.propertyId).address}
                </span>
                <Badge variant="outline" className="ml-auto money text-[10px]">
                  {zar(dl.salePrice, { decimals: false })}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Pages">
            {navItems.map((item) => (
              <CommandItem
                key={item.label}
                value={item.label}
                onSelect={() => {
                  setOpen(false);
                  if ("to" in item) {
                    navigate({ to: item.to });
                  } else if (item.label === "Calculators") {
                    toggleCalculator(true);
                  }
                }}
              >
                <item.icon className="size-4" /> {item.label}
              </CommandItem>
            ))}
            <CommandItem
              value="New deal"
              onSelect={() => {
                setOpen(false);
                navigate({ to: "/deals/new" });
              }}
            >
              Create new deal
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <QuickDealModal
        open={quickModalOpen}
        onOpenChange={setQuickModalOpen}
        onSuccess={(dealId) => navigate({ to: "/deals/$dealId", params: { dealId } })}
      />
    </header>
  );
}

export { relative };
