import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, KanbanSquare, Timer, Coins, ShieldCheck, FolderOpen,
  Calculator, Users2, BarChart3, Settings, ChevronLeft, Menu, X,
} from "lucide-react";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const navItems = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Pipeline", to: "/pipeline", icon: KanbanSquare },
  { label: "Countdown Board", to: "/countdown", icon: Timer },
  { label: "Commission", to: "/commission", icon: Coins },
  { label: "Compliance", to: "/compliance/ffc", icon: ShieldCheck },
  { label: "Documents", to: "/documents", icon: FolderOpen },
  { label: "Calculators", to: "/calculators/bond", icon: Calculator },
  { label: "Leads", to: "/leads", icon: Users2 },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Settings", to: "/settings/agency", icon: Settings },
] as const;

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to.split("/").slice(0, 2).join("/"));
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            title={item.label}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
              />
            )}
            <item.icon className="size-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useApp();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl backdrop-saturate-150 transition-[width] duration-300 md:flex",
        sidebarCollapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
          DS
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-sidebar-accent-foreground">Dream Supreme</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Properties</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex-1 overflow-y-auto scrollbar-thin">
        <NavList collapsed={sidebarCollapsed} />
      </div>
      <button
        onClick={toggleSidebar}
        className="m-3 flex items-center justify-center gap-2 rounded-lg border border-sidebar-border py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60"
      >
        <ChevronLeft className={cn("size-4 transition-transform", sidebarCollapsed && "rotate-180")} />
        {!sidebarCollapsed && "Collapse"}
      </button>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const primary = navItems.slice(0, 4);
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-sidebar/95 backdrop-blur-sm md:hidden"
          >
            <div className="flex h-16 items-center justify-between px-5">
              <span className="font-display font-semibold text-sidebar-accent-foreground">Menu</span>
              <button onClick={() => setOpen(false)} className="text-sidebar-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-2">
              <NavList collapsed={false} onNavigate={() => setOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
        {primary.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              <span className="truncate px-1">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground">
          <Menu className="size-5" />
          More
        </button>
      </div>
    </>
  );
}
