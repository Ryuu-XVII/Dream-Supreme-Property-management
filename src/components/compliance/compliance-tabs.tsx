import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ShieldCheck, Users, ScrollText } from "lucide-react";

const tabs = [
  { to: "/admin/compliance/ffc", label: "FFC Register", icon: ShieldCheck },
  { to: "/admin/compliance/fica", label: "FICA Register", icon: Users },
  { to: "/admin/compliance/audit", label: "Audit Log", icon: ScrollText },
] as const;

export function ComplianceTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border pb-1">
      {tabs.map((t) => {
        const active = pathname === t.to;
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
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
