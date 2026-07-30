import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Building2, Bell, Users, UserCircle } from "lucide-react";

const tabs = [
  { to: "/settings/profile" as const, label: "My Profile", icon: UserCircle },
  { to: "/settings/agency" as const, label: "Agency Profile", icon: Building2 },
  { to: "/settings/notifications" as const, label: "Notifications", icon: Bell },
  { to: "/settings/users" as const, label: "Users", icon: Users },
];

export function SettingsTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 overflow-x-auto scrollbar-thin border-b border-border">
      <nav className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4 shrink-0" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
