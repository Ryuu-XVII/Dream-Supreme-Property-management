import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  Menu,
  X,
  FileText,
  Activity,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const adminNavItems = [
  { label: "Home", to: "/admin", icon: LayoutDashboard },
  { label: "Team Members", to: "/admin/users", icon: Users },
  { label: "Properties", to: "/admin/properties", icon: Building2 },
  { label: "Deals", to: "/admin/deals", icon: FileText },
  { label: "Financials", to: "/admin/financials", icon: FileText },
  { label: "Commission Rules", to: "/admin/commission-rules", icon: FileText },
  { label: "Compliance", to: "/admin/compliance/ffc", icon: ShieldCheck },
  { label: "Agency Config", to: "/admin/agency", icon: Building2 },
  { label: "Notifications", to: "/admin/notifications", icon: Bell },
  { label: "Settings", to: "/admin/settings", icon: Settings },
] as const;

function AdminNavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 px-3">
      {adminNavItems.map((item) => {
        const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
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
                layoutId="admin-nav-active"
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
              />
            )}
            <item.icon className="size-4.5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar() {
  const { sidebarCollapsed } = useApp();
  const { account } = useAuth();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl backdrop-saturate-150 transition-[width] duration-300 md:flex",
        sidebarCollapsed ? "w-19" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
          {initials(account?.fullName || "Admin User")}
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-sidebar-accent-foreground">
              Admin Console
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Dream Supreme</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex-1 overflow-y-auto scrollbar-thin">
        <AdminNavList collapsed={sidebarCollapsed} />
      </div>
      <div className="mt-auto border-t border-sidebar-border p-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LayoutDashboard className="size-4.5 shrink-0" />
          {!sidebarCollapsed && <span className="truncate">Agent Portal</span>}
        </Link>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const primary = adminNavItems.slice(0, 4);
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
              <span className="font-display font-semibold text-sidebar-accent-foreground">
                Admin Menu
              </span>
              <button onClick={() => setOpen(false)} className="text-sidebar-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-2">
              <AdminNavList collapsed={false} onNavigate={() => setOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-sidebar-border bg-sidebar/90 backdrop-blur-lg md:hidden">
        {primary.map((item) => {
          const active =
            item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                active ? "text-sidebar-primary font-semibold" : "text-sidebar-foreground/70",
              )}
            >
              <item.icon className="size-5" />
              <span className="truncate px-1">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-sidebar-foreground/70"
        >
          <Menu className="size-5" />
          <span>More</span>
        </button>
      </div>
    </>
  );
}
