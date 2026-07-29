import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STAGES, type Stage, type User } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, daysUntil, urgencyOf, type Urgency } from "@/lib/format";

export function StageBadge({ stage, large }: { stage: Stage; large?: boolean }) {
  const idx = STAGES.indexOf(stage);
  const tone =
    idx >= 11
      ? "bg-success/12 text-success border-success/30"
      : idx >= 7
        ? "bg-info/12 text-info border-info/30"
        : idx >= 4
          ? "bg-warning/15 text-warning border-warning/40"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn(tone, large && "px-3 py-1 text-sm")}>
      <span className="mr-1.5 font-mono text-[10px] opacity-70">{idx + 1}</span>
      {stage}
    </Badge>
  );
}

export function UrgencyBadge({ dueDate, status }: { dueDate: string; status?: string }) {
  const days = daysUntil(dueDate);
  const u: Urgency =
    status && status !== "Open" && status !== "Extended" ? "safe" : urgencyOf(days);
  const label =
    status === "Fulfilled"
      ? "Fulfilled"
      : status === "Waived"
        ? "Waived"
        : status === "Failed"
          ? "Failed"
          : days < 0
            ? `Lapsed ${Math.abs(days)}d`
            : `${days}d left`;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono",
        status === "Failed"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : status === "Waived"
            ? "border-border bg-muted text-muted-foreground"
            : status === "Fulfilled"
              ? "border-success/30 bg-success/10 text-success"
              : u === "lapsed" || u === "critical"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : u === "warning"
                  ? "border-warning/40 bg-warning/15 text-warning"
                  : "border-success/30 bg-success/10 text-success",
      )}
    >
      {label}
    </Badge>
  );
}

export function AgentAvatar({
  user,
  showName,
  size = 7,
}: {
  user: User;
  showName?: boolean;
  size?: number;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="shrink-0" style={{ width: `${size * 4}px`, height: `${size * 4}px` }}>
        <AvatarFallback
          style={{ backgroundColor: user.colour }}
          className="text-[10px] font-semibold text-white"
        >
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>
      {showName && <span className="truncate text-sm">{user.name}</span>}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Urgency }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 rounded-full",
        tone === "lapsed" || tone === "critical"
          ? "bg-destructive pulse-danger"
          : tone === "warning"
            ? "bg-warning"
            : "bg-success",
      )}
    />
  );
}

export function FicaBadge({ status }: { status: "Complete" | "Partial" | "Not Started" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "Complete" && "border-success/30 bg-success/10 text-success",
        status === "Partial" && "border-warning/40 bg-warning/15 text-warning",
        status === "Not Started" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      FICA {status}
    </Badge>
  );
}
