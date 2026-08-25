import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { m as motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, KpiCard, EmptyState, CardSkeleton } from "@/components/ui-kit";
import { AgentAvatar } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { dateFmt, daysUntil, urgencyOf, urgencyClass, type Urgency } from "@/lib/format";
import type { Condition, ConditionType, Deal, User } from "@/types";
import { useCountdownData } from "@/data/operations";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  LayoutGrid,
  Rows3,
  Landmark,
  Home,
  Wallet,
  Building2,
  Search,
  Zap,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CalendarClock,
  CalendarDays,
  Ban,
  MapPin,
} from "lucide-react";

export const Route = createFileRoute("/countdown")({
  component: CountdownBoard,
  head: () => ({
    meta: [
      { title: "Countdown Board | Dream Supreme Properties" },
      {
        name: "description",
        content: "Live countdown board tracking every suspensive condition across the agency.",
      },
      { property: "og:title", content: "Countdown Board | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Live countdown board tracking every suspensive condition across the agency.",
      },
    ],
  }),
});

const typeIcon: Record<ConditionType, React.ComponentType<{ className?: string }>> = {
  "Bond Approval": Landmark,
  "Sale of Existing Property": Home,
  "Deposit Payment": Wallet,
  "Body Corporate Consent": Building2,
  "Due Diligence": Search,
  "Electrical Compliance": Zap,
};

type LocalStatus = "Open" | "Fulfilled" | "Extended" | "Waived";

type ConditionRow = Condition & { deal: Deal & { property?: { address?: string } }; agent?: User };

function urgencyTone(u: Urgency) {
  if (u === "lapsed" || u === "critical") return "danger" as const;
  if (u === "warning") return "warning" as const;
  return "success" as const;
}

function LiveSeconds() {
  const [secs, setSecs] = useState(new Date().getSeconds());
  useEffect(() => {
    const t = setInterval(() => setSecs(new Date().getSeconds()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="money text-[10px] tabular-nums text-muted-foreground">
      live · {String(secs).padStart(2, "0")}s
    </span>
  );
}

function CountdownDisplay({
  days,
  status,
  mostUrgent,
}: {
  days: number;
  status: LocalStatus;
  mostUrgent?: boolean;
}) {
  if (status !== "Open" && status !== "Extended") {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-success" />
        <span className="font-display text-sm font-semibold text-success">{status}</span>
      </div>
    );
  }
  const lapsed = days < 0;
  return (
    <div className="flex flex-col">
      {lapsed ? (
        <div className="flex items-baseline gap-2">
          <span className="money text-3xl font-bold leading-none text-destructive">
            {Math.abs(days)}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
            days overdue
          </span>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "money text-4xl font-bold leading-none",
              days <= 3 ? "text-destructive" : days <= 7 ? "text-warning" : "text-success",
            )}
          >
            {days}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            days remaining
          </span>
        </div>
      )}
      <div className="mt-1 flex items-center gap-2">
        {lapsed && (
          <Badge
            variant="outline"
            className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
          >
            LAPSED
          </Badge>
        )}
        {mostUrgent && <LiveSeconds />}
      </div>
    </div>
  );
}

function ExtendDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (date: string, reason: string) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend condition deadline</DialogTitle>
          <DialogDescription>
            Choose a new due date and capture a reason for the extension.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="extend-date">New due date</Label>
            <Input
              id="extend-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="extend-reason">Reason for extension</Label>
            <Textarea
              id="extend-reason"
              placeholder="e.g. Bank requested additional supporting documents"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!date || !reason}
            onClick={() => {
              onConfirm(date, reason);
              onOpenChange(false);
              setDate("");
              setReason("");
            }}
          >
            Confirm extension
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionButtons({
  row,
  onAction,
}: {
  row: ConditionRow;
  onAction: (
    id: string,
    status: LocalStatus,
    extra?: { dueDate?: string; reason?: string },
  ) => void;
}) {
  const [extendOpen, setExtendOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 border-success/30 text-success hover:bg-success/10"
        onClick={() => {
          void onAction(row.id, "Fulfilled");
        }}
      >
        <CheckCircle2 className="size-3.5" /> Fulfilled
      </Button>
      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setExtendOpen(true)}>
        <CalendarClock className="size-3.5" /> Extend
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-muted-foreground"
        onClick={() => {
          void onAction(row.id, "Waived");
        }}
      >
        <Ban className="size-3.5" /> Waive
      </Button>
      <ExtendDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        onConfirm={(date, reason) => {
          void onAction(row.id, "Extended", { dueDate: date, reason });
        }}
      />
    </div>
  );
}

function ConditionCard({
  row,
  status,
  dueDate,
  days,
  mostUrgent,
  onAction,
  index,
}: {
  row: ConditionRow;
  status: LocalStatus;
  dueDate: string;
  days: number;
  mostUrgent?: boolean;
  onAction: (
    id: string,
    status: LocalStatus,
    extra?: { dueDate?: string; reason?: string },
  ) => void;
  index: number;
}) {
  const u = urgencyOf(days);
  const active = status === "Open" || status === "Extended";
  const Icon = typeIcon[row.type];
  const agent = row.agent ?? {
    id: "",
    name: "Unassigned",
    email: "",
    mobile: "",
    branch: "",
    active: false,
    role: "Agent" as const,
    seniority: "Non-Principal Agent" as const,
    colour: "#64748b",
    ppra: "",
    ffc: null,
  };
  const property = row.deal.property;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.4), duration: 0.3 }}
    >
      <GlassCard
        className={cn(
          "flex h-full flex-col gap-3",
          active &&
            (u === "lapsed" || u === "critical") &&
            "pulse-danger ring-1 ring-destructive/40",
          active && u === "warning" && "ring-1 ring-warning/40",
          active && u === "safe" && "ring-1 ring-success/20",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                u === "lapsed" || u === "critical"
                  ? "bg-destructive/10 text-destructive"
                  : u === "warning"
                    ? "bg-warning/15 text-warning"
                    : "bg-success/10 text-success",
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.type}</p>
              <Link
                to={"/pipeline" as any}
                className="money truncate text-xs text-primary hover:underline"
              >
                {row.deal.ref}
              </Link>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 text-[10px]", urgencyClass[active ? u : "safe"])}
          >
            {row.responsibleParty}
          </Badge>
        </div>

        <p className="line-clamp-2 min-h-9 text-sm text-muted-foreground">{row.description}</p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{property?.address}</span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <AgentAvatar user={agent} showName size={6} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {dateFmt(dueDate)}
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <CountdownDisplay days={days} status={status} mostUrgent={mostUrgent} />
        </div>

        {active && (
          <div className="mt-1">
            <ActionButtons row={row} onAction={onAction} />
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

function ConditionRowView({
  row,
  status,
  dueDate,
  days,
  mostUrgent,
  onAction,
}: {
  row: ConditionRow;
  status: LocalStatus;
  dueDate: string;
  days: number;
  mostUrgent?: boolean;
  onAction: (
    id: string,
    status: LocalStatus,
    extra?: { dueDate?: string; reason?: string },
  ) => void;
}) {
  const u = urgencyOf(days);
  const active = status === "Open" || status === "Extended";
  const Icon = typeIcon[row.type];
  const agent = row.agent ?? {
    id: "",
    name: "Unassigned",
    email: "",
    mobile: "",
    branch: "",
    active: false,
    role: "Agent" as const,
    seniority: "Non-Principal Agent" as const,
    colour: "#64748b",
    ppra: "",
    ffc: null,
  };
  const property = row.deal.property;
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-4 rounded-lg border border-border bg-card/50 p-3",
        active && (u === "lapsed" || u === "critical") && "ring-1 ring-destructive/40",
        active && u === "warning" && "ring-1 ring-warning/40",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          u === "lapsed" || u === "critical"
            ? "bg-destructive/10 text-destructive"
            : u === "warning"
              ? "bg-warning/15 text-warning"
              : "bg-success/10 text-success",
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{row.type}</p>
        <p className="truncate text-xs text-muted-foreground">{row.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <Link to={"/pipeline" as any} className="money text-primary hover:underline">
            {row.deal.ref}
          </Link>
          <span className="truncate text-muted-foreground">· {property?.address}</span>
        </div>
      </div>
      <div className="min-w-0">
        <AgentAvatar user={agent} showName size={6} />
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" /> {dateFmt(dueDate)}
        </p>
      </div>
      <CountdownDisplay days={days} status={status} mostUrgent={mostUrgent} />
      {active ? <ActionButtons row={row} onAction={onAction} /> : <span />}
    </div>
  );
}

function CountdownBoard() {
  const { isReadOnly } = useAuth();
  const countdown = useCountdownData();
  const loading = countdown.isLoading;
  const openConditions = useMemo(
    () => (countdown.data?.conditions ?? []) as ConditionRow[],
    [countdown.data?.conditions],
  );
  const users = useMemo(() => countdown.data?.users ?? [], [countdown.data?.users]);
  const [view, setView] = useState<"cards" | "rows">("cards");
  const [agentFilter, setAgentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const conditionTypes = useMemo(
    () => Array.from(new Set(openConditions.map((c) => c.type))),
    [openConditions],
  );
  const responsibleAgents = useMemo(() => {
    const ids = new Set(openConditions.map((c) => c.responsibleUserId));
    return users.filter((u) => ids.has(u.id));
  }, [openConditions, users]);

  const rows = useMemo(() => {
    return openConditions.map((c) => {
      const status: LocalStatus = c.status === "Failed" ? "Open" : (c.status as LocalStatus);
      const dueDate = c.dueDate;
      const days = daysUntil(dueDate);
      return { row: c, status, dueDate, days };
    });
  }, [openConditions]);

  const filtered = useMemo(() => {
    return rows.filter(({ row, status }) => {
      if (agentFilter !== "all" && row.responsibleUserId !== agentFilter) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      return true;
    });
  }, [rows, agentFilter, typeFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const activeA = a.status === "Open" || a.status === "Extended";
      const activeB = b.status === "Open" || b.status === "Extended";
      if (activeA !== activeB) return activeA ? -1 : 1;
      return a.days - b.days;
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "Open" || r.status === "Extended");
    return {
      total: rows.length,
      overdue: active.filter((r) => r.days < 0).length,
      dueSoon: active.filter((r) => r.days >= 0 && r.days <= 7).length,
      onTrack: active.filter((r) => r.days > 7).length,
    };
  }, [rows]);

  const mostUrgentId = sorted.find((r) => r.status === "Open" || r.status === "Extended")?.row.id;

  async function handleAction(
    id: string,
    status: LocalStatus,
    extra?: { dueDate?: string; reason?: string },
  ) {
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to update conditions.");
    const statusMap: Record<LocalStatus, string> = {
      Open: "pending",
      Fulfilled: "fulfilled",
      Extended: "extended",
      Waived: "waived",
    };
    const { error } = await supabase.rpc("set_condition_status", {
      p_condition_id: id,
      p_status: statusMap[status],
      p_new_due_on: extra?.dueDate ?? null,
      p_reason: extra?.reason ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await countdown.refetch();
    toast.success(
      status === "Extended"
        ? `Deadline extended to ${dateFmt(extra?.dueDate ?? "")}`
        : `Condition marked ${status.toLowerCase()}`,
    );
  }

  return (
    <AppShell
      title="Countdown Board"
      description="Every suspensive condition across the agency, ranked by urgency."
      crumbs={[{ label: "Dashboard", to: "/" }, { label: "Countdown Board" }]}
      actions={
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            size="sm"
            variant={view === "cards" ? "secondary" : "ghost"}
            className="h-7 gap-1 px-2"
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="size-4" /> Cards
          </Button>
          <Button
            size="sm"
            variant={view === "rows" ? "secondary" : "ghost"}
            className="h-7 gap-1 px-2"
            onClick={() => setView("rows")}
          >
            <Rows3 className="size-4" /> Rows
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total conditions" value={stats.total} icon={Timer} delay={0} />
        <KpiCard
          label="Overdue"
          value={stats.overdue}
          tone="danger"
          icon={AlertTriangle}
          delay={0.05}
        />
        <KpiCard
          label="Due this week"
          value={stats.dueSoon}
          tone="warning"
          icon={Clock3}
          delay={0.1}
        />
        <KpiCard
          label="On track"
          value={stats.onTrack}
          tone="success"
          icon={CheckCircle2}
          delay={0.15}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {responsibleAgents.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Condition type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All condition types</SelectItem>
            {conditionTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Extended">Extended</SelectItem>
            <SelectItem value="Fulfilled">Fulfilled</SelectItem>
            <SelectItem value="Waived">Waived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            title="No matching conditions"
            message="Try adjusting your filters to see conditions."
          />
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {sorted.map(({ row, status, dueDate, days }, i) => (
                <ConditionCard
                  key={row.id}
                  row={row}
                  status={status}
                  dueDate={dueDate}
                  days={days}
                  mostUrgent={row.id === mostUrgentId}
                  onAction={handleAction}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-2 overflow-x-auto scrollbar-thin">
            <AnimatePresence>
              {sorted.map(({ row, status, dueDate, days }, i) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.25 }}
                  className="min-w-full"
                >
                  <ConditionRowView
                    row={row}
                    status={status}
                    dueDate={dueDate}
                    days={days}
                    mostUrgent={row.id === mostUrgentId}
                    onAction={handleAction}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppShell>
  );
}
