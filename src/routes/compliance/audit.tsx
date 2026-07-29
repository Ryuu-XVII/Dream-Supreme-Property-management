import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";
import { GlassCard, TableSkeleton, EmptyState } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dateTimeFmt } from "@/lib/format";
import type { AuditEvent } from "@/data/state";
import { useAuditData } from "@/data/operations";
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  ArrowRightLeft,
  Calculator,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/compliance/audit")({
  component: AuditLog,
  head: () => ({
    meta: [
      { title: "Audit Log | Dream Supreme Properties" },
      {
        name: "description",
        content: "Full audit trail of every action taken across deals, commissions, and records.",
      },
      { property: "og:title", content: "Audit Log | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Full audit trail of every action taken across deals, commissions, and records.",
      },
    ],
  }),
});

const actionIcon: Record<AuditEvent["action"], React.ComponentType<{ className?: string }>> = {
  Created: Plus,
  Updated: Pencil,
  "Stage Changed": ArrowRightLeft,
  Calculated: Calculator,
  Deleted: Trash2,
};

const actionTone: Record<AuditEvent["action"], string> = {
  Created: "border-success/30 bg-success/10 text-success",
  Updated: "border-info/30 bg-info/10 text-info",
  "Stage Changed": "border-primary/30 bg-primary/10 text-primary",
  Calculated: "border-warning/40 bg-warning/15 text-warning",
  Deleted: "border-destructive/30 bg-destructive/10 text-destructive",
};

function diffKeys(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys);
}

function JsonBlock({
  data,
  compareWith,
  tint,
}: {
  data: Record<string, unknown>;
  compareWith: Record<string, unknown>;
  tint: "success" | "destructive";
}) {
  const keys = diffKeys(data, compareWith);
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
      {"{\n"}
      {keys.map((k) => {
        const changed = JSON.stringify(data[k]) !== JSON.stringify(compareWith[k]);
        return (
          <div
            key={k}
            className={cn(
              "pl-3",
              changed &&
                (tint === "success"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"),
            )}
          >
            "{k}": {JSON.stringify(data[k])},
          </div>
        );
      })}
      {"}"}
    </pre>
  );
}

function AuditRow({
  event,
  expanded,
  onToggle,
}: {
  event: AuditEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = actionIcon[event.action];
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="money whitespace-nowrap">{dateTimeFmt(event.at)}</TableCell>
        <TableCell>{event.user}</TableCell>
        <TableCell>
          <Badge variant="outline">{event.entityType}</Badge>
        </TableCell>
        <TableCell className="money">{event.entityRef}</TableCell>
        <TableCell>
          <Badge variant="outline" className={cn("gap-1", actionTone[event.action])}>
            <Icon className="size-3" /> {event.action}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[280px] truncate text-muted-foreground">
          {event.summary}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="p-0">
            <div className="grid gap-4 border-t border-border bg-muted/30 p-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Before
                </p>
                <JsonBlock data={event.before} compareWith={event.after} tint="destructive" />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  After
                </p>
                <JsonBlock data={event.after} compareWith={event.before} tint="success" />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function toCsvValue(v: unknown) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function AuditLog() {
  const auditQuery = useAuditData();
  const auditEvents = useMemo(
    () => (auditQuery.data?.events || []) as AuditEvent[],
    [auditQuery.data?.events],
  );
  const users = useMemo(() => auditQuery.data?.users || [], [auditQuery.data?.users]);
  const loading = auditQuery.isLoading;
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageSize, setPageSize] = useState("25");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entityTypes = useMemo(
    () => Array.from(new Set(auditEvents.map((e) => e.entityType))),
    [auditEvents],
  );
  const actions = useMemo(
    () => Array.from(new Set(auditEvents.map((e) => e.action))),
    [auditEvents],
  );

  const filtered = useMemo(() => {
    return auditEvents.filter((e) => {
      if (userFilter !== "all" && e.user !== userFilter) return false;
      if (entityFilter !== "all" && e.entityType !== entityFilter) return false;
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (from && new Date(e.at) < new Date(from)) return false;
      if (to && new Date(e.at) > new Date(to + "T23:59:59")) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${e.user} ${e.entityType} ${e.entityRef} ${e.action} ${e.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditEvents, userFilter, entityFilter, actionFilter, from, to, search]);

  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const pageRows = filtered.slice((page - 1) * size, page * size);

  function exportCsv() {
    const header = ["Timestamp", "User", "Entity Type", "Entity Ref", "Action", "Summary"];
    const lines = [header.join(",")].concat(
      filtered.map((e) =>
        [dateTimeFmt(e.at), e.user, e.entityType, e.entityRef, e.action, e.summary]
          .map(toCsvValue)
          .join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit log exported", {
      description: `${filtered.length} events exported to CSV`,
    });
  }

  return (
    <AppShell
      title="Audit Log"
      description="Searchable, filterable record of every change made across the platform."
      crumbs={[{ label: "Compliance" }, { label: "Audit Log" }]}
      actions={
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
          <Download className="size-4" /> Export CSV
        </Button>
      }
    >
      <ComplianceTabs />

      <GlassCard className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search events…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={userFilter}
            onValueChange={(v) => {
              setUserFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.name}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={entityFilter}
            onValueChange={(v) => {
              setEntityFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} events matched</span>
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No audit events found"
              message="Try widening your filters or date range."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Entity type</TableHead>
                    <TableHead>Entity ref</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((e) => (
                    <AuditRow
                      key={e.id}
                      event={e}
                      expanded={expandedId === e.id}
                      onToggle={() => setExpandedId((id) => (id === e.id ? null : e.id))}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={pageSize}
                  onValueChange={(v) => {
                    setPageSize(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </GlassCard>
    </AppShell>
  );
}
