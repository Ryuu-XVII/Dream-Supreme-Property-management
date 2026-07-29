import { format, formatDistanceStrict } from "date-fns";

export function zar(cents: number, opts: { decimals?: boolean } = {}) {
  const v = cents / 100;
  return `R ${v.toLocaleString("en-ZA", {
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
  })}`;
}

export function zarCompact(cents: number) {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(2)}m`;
  if (Math.abs(v) >= 1000) return `R ${(v / 1000).toFixed(0)}k`;
  return `R ${v.toFixed(0)}`;
}

export function pct(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

export function dateFmt(d: string | Date) {
  return format(new Date(d), "dd MMM yyyy");
}

export function dateTimeFmt(d: string | Date) {
  return format(new Date(d), "dd MMM yyyy, HH:mm");
}

export function daysUntil(d: string | Date) {
  const target = new Date(d);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function relative(d: string | Date) {
  return formatDistanceStrict(new Date(d), new Date(), { addSuffix: true });
}

export type Urgency = "lapsed" | "critical" | "warning" | "safe";

export function urgencyOf(days: number): Urgency {
  if (days < 0) return "lapsed";
  if (days <= 3) return "critical";
  if (days <= 7) return "warning";
  return "safe";
}

export const urgencyClass: Record<Urgency, string> = {
  lapsed: "bg-destructive/10 text-destructive border-destructive/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  safe: "bg-success/10 text-success border-success/30",
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
