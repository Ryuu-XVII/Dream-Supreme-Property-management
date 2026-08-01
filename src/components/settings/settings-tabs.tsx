import { UserCircle, ShieldCheck, Bell, Mail, KeyRound } from "lucide-react";

export function SettingsTabs() {
  return (
    <div className="mb-6 border-b border-border pb-2">
      <div className="flex items-center gap-6 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5 text-primary font-semibold">
          <UserCircle className="size-4" /> Agent Workspace Settings
        </span>
      </div>
    </div>
  );
}
