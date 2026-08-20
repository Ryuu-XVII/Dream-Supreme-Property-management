import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Sun, Moon, Monitor, LogOut, Calculator, PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
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
import { NotificationBell } from "./notification-bell";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { zar } from "@/lib/format";
import { useDealSearch } from "@/data/deals";
import { navItems } from "./sidebar";

import { FloatingCalculatorModal } from "@/components/calculators/floating-calculator-modal";

export function Header() {
  const [open, setOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useApp();
  const { activeAccount, isReadOnly, signOut } = useAuth();
  const dealSearch = useDealSearch(open);
  const deals = dealSearch.data ?? [];

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

      <NotificationBell accountId={activeAccount?.id} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full pl-1 pr-2 transition-colors hover:bg-accent">
            <UserAvatar
              avatarKey={activeAccount?.avatarKey}
              name={me.name}
              fallbackClassName="bg-primary text-xs text-primary-foreground"
            />
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
