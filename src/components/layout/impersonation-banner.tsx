import { useNavigate } from "@tanstack/react-router";
import { Eye, LogOut, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function ImpersonationBanner() {
  const { impersonatedAccount, stopImpersonating } = useAuth();
  const navigate = useNavigate();

  if (!impersonatedAccount) return null;

  const handleExit = () => {
    stopImpersonating();
    navigate({ to: "/admin/users" });
  };

  return (
    <div className="relative z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-xs font-medium text-amber-950 dark:text-amber-100 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <Badge
          variant="outline"
          className="border-amber-500 bg-amber-500 text-white font-bold text-[10px] tracking-wide uppercase px-2 py-0.5 shadow-sm"
        >
          <ShieldAlert className="mr-1 size-3" />
          Strict Read-Only Mode
        </Badge>
        <span>
          Viewing Agent Portal for{" "}
          <strong className="font-semibold underline decoration-amber-500/60 underline-offset-2">
            {impersonatedAccount.fullName}
          </strong>{" "}
          <span className="text-amber-800 dark:text-amber-300">({impersonatedAccount.email})</span>{" "}
          — No credentials required.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExit}
        className="h-7 border-amber-600/40 bg-amber-500/20 px-3 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-500/35 dark:border-amber-400/40 dark:text-amber-100 dark:hover:bg-amber-500/40"
      >
        <LogOut className="mr-1.5 size-3" />
        Return to Admin Portal
      </Button>
    </div>
  );
}
