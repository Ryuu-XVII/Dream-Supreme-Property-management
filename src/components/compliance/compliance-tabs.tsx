import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ShieldCheck, Users, ScrollText, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/auth-routing";

// The audit log and POPIA data-subject requests are agency-wide records about
// everyone, and audit_log's RLS policy already admits administrators only — an
// agent opening that tab saw an empty table with no explanation. Both are now
// hidden from agents rather than offered and then denied.
const tabs = [
  { to: "/compliance/ffc", label: "FFC Register", icon: ShieldCheck, adminOnly: false },
  { to: "/compliance/fica", label: "FICA Register", icon: Users, adminOnly: false },
  { to: "/compliance/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
  { to: "/compliance/popia", label: "POPIA Requests", icon: Lock, adminOnly: true },
] as const;

export function ComplianceTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { activeAccount } = useAuth();
  const isAdmin = canAccessAdmin(activeAccount);
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border pb-1">
      {visibleTabs.map((t) => {
        const active = pathname === t.to;
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to as any}
            className={cn(
              "flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
