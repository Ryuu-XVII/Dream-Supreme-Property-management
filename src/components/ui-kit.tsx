import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Inbox } from "lucide-react";

export function GlassCard({ className, children, ...rest }: React.ComponentProps<"div">) {
  return (
    <div className={cn("glass lift rounded-xl p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  trend,
  tone = "default",
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  trend?: number;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: React.ComponentType<{ className?: string }>;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <GlassCard className="h-full">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {Icon && (
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg",
                tone === "success" && "bg-success/10 text-success",
                tone === "warning" && "bg-warning/15 text-warning",
                tone === "danger" && "bg-destructive/10 text-destructive",
                tone === "default" && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
            </span>
          )}
        </div>
        <p
          className={cn(
            "money mt-3 text-2xl font-semibold sm:text-[26px]",
            tone === "danger" && "text-destructive",
            tone === "success" && "text-success",
          )}
        >
          {value}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {trend != null && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 border-transparent px-1.5 py-0 text-[10px]",
                trend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(trend)}%
            </Badge>
          )}
          {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-7" />
      </span>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-9" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-40" />
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  );
}

export function useFakeLoad(ms = 450) {
  const [loading, setLoading] = useStateSafe(ms);
  return loading;
}

import { useEffect, useState } from "react";
function useStateSafe(ms: number) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return [loading, setLoading] as const;
}
