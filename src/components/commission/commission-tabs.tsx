import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

// No "Rules Configuration" tab: commission rule sets are configured in the
// Admin Console (/admin/commission-rules). Offering it here showed an
// Admin & Agent a "New Rule Set" button inside the agent portal, and gave a
// plain agent a tab that only redirected them away.
const tabs = [
  { label: "Monthly Reconciliation", to: "/commission/reconciliation" as const },
  { label: "Agent Earnings", to: "/commission/earnings" as const },
];

export function CommissionTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 overflow-x-auto scrollbar-thin border-b border-border">
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                active && "text-foreground",
              )}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
