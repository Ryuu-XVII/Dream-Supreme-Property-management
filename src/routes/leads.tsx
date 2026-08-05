import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, EmptyState, TableSkeleton, useFakeLoad } from "@/components/ui-kit";
import { AgentAvatar } from "@/components/badges";
import { leads as seedLeads, users, userById, type Lead } from "@/data/mock";
import { dateFmt, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ArrowUpDown, XCircle, Users } from "lucide-react";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Manage leads captured from the bond, transfer, affordability and yield calculators.",
      },
      { property: "og:title", content: "Leads | Dream Supreme Properties" },
      {
        property: "og:description",
        content:
          "Manage leads captured from the bond, transfer, affordability and yield calculators.",
      },
    ],
  }),
  component: LeadsPage,
});

const SOURCE_TONE: Record<Lead["source"], string> = {
  Bond: "bg-info/12 text-info border-info/30",
  Transfer: "bg-primary/12 text-primary border-primary/30",
  Affordability: "bg-warning/15 text-warning border-warning/40",
  Yield: "bg-success/12 text-success border-success/30",
};

const STATUS_TONE: Record<Lead["status"], string> = {
  New: "bg-muted text-muted-foreground border-border",
  Contacted: "bg-info/12 text-info border-info/30",
  Qualified: "bg-warning/15 text-warning border-warning/40",
  Converted: "bg-success/12 text-success border-success/30",
  Closed: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUSES: Lead["status"][] = ["New", "Contacted", "Qualified", "Converted", "Closed"];
const SOURCES: Lead["source"][] = ["Bond", "Transfer", "Affordability", "Yield"];

function SourceBadge({ source }: { source: Lead["source"] }) {
  return (
    <Badge variant="outline" className={cn(SOURCE_TONE[source])}>
      {source}
    </Badge>
  );
}

function StatusBadge({ status }: { status: Lead["status"] }) {
  return (
    <Badge variant="outline" className={cn(STATUS_TONE[status])}>
      {status}
    </Badge>
  );
}

type SortKey = "name" | "email" | "mobile" | "source" | "agent" | "status" | "createdAt";
const ALL_COLS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile" },
  { key: "source", label: "Source" },
  { key: "agent", label: "Assigned agent" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created" },
];

interface Filters {
  status: string;
  source: string;
  agent: string;
  from: string;
  to: string;
}

const defaultFilters: Filters = { status: "all", source: "all", agent: "all", from: "", to: "" };

function parsePayload(payload: string) {
  // "Calculated bond repayment for R2,500,000 loan at 11.50% over 20 years"
  const parts = payload
    .split(/[,]|\bat\b|\bover\b|\bwith\b|\bfor\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

function LeadSheet({
  lead,
  open,
  onOpenChange,
  onSave,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (lead: Lead) => void;
}) {
  const [draft, setDraft] = useState<Lead | null>(lead);

  if (draft?.id !== lead?.id) setDraft(lead);

  if (!draft) return null;

  const payloadParts = parsePayload(draft.payload);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="truncate">{draft.name}</SheetTitle>
          <SheetDescription>
            Lead captured {dateFmt(draft.createdAt)} via {draft.source} calculator
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contact info
            </h3>
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Email</span>
                <span className="min-w-0 truncate">{draft.email}</span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Mobile</span>
                <span className="money">{draft.mobile}</span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Source</span>
                <SourceBadge source={draft.source} />
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Calculator payload
            </h3>
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {payloadParts.map((part, i) => (
                <p key={i} className="text-muted-foreground">
                  <span className="money text-foreground">{part}</span>
                </p>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Assigned agent</Label>
            <Select
              value={draft.assignedTo ?? "unassigned"}
              onValueChange={(v) =>
                setDraft({ ...draft, assignedTo: v === "unassigned" ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users
                  .filter((u) => u.role === "Agent")
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft({ ...draft, status: v as Lead["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Notes</Label>
            <Textarea
              rows={4}
              value={draft.notes}
              placeholder="Add a note about this lead..."
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(draft);
                toast.success("Lead updated", {
                  description: `${draft.name}'s record has been saved.`,
                });
                onOpenChange(false);
              }}
            >
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LeadsTable({
  rows,
  onOpen,
  onQuickAssign,
  onQuickStatus,
}: {
  rows: Lead[];
  onOpen: (l: Lead) => void;
  onQuickAssign: (id: string, agent: string) => void;
  onQuickStatus: (id: string, status: Lead["status"]) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [visibleCols, setVisibleCols] = useState<Record<SortKey, boolean>>({
    name: true,
    email: true,
    mobile: true,
    source: true,
    agent: true,
    status: true,
    createdAt: true,
  });

  const sorted = useMemo(() => {
    const withMeta = rows.map((l) => ({
      lead: l,
      agent: l.assignedTo ? userById(l.assignedTo).name : "",
    }));
    withMeta.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.lead.name.localeCompare(b.lead.name);
          break;
        case "email":
          cmp = a.lead.email.localeCompare(b.lead.email);
          break;
        case "mobile":
          cmp = a.lead.mobile.localeCompare(b.lead.mobile);
          break;
        case "source":
          cmp = a.lead.source.localeCompare(b.lead.source);
          break;
        case "agent":
          cmp = a.agent.localeCompare(b.agent);
          break;
        case "status":
          cmp = a.lead.status.localeCompare(b.lead.status);
          break;
        case "createdAt":
          cmp = new Date(a.lead.createdAt).getTime() - new Date(b.lead.createdAt).getTime();
          break;
      }
      return cmp * sortDir;
    });
    return withMeta;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No leads match your filters"
        message="Try widening your filters or resetting them to see more leads."
      />
    );
  }

  return (
    <GlassCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{sorted.length} leads</p>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ALL_COLS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={visibleCols[c.key]}
                  onCheckedChange={(v) => setVisibleCols((s) => ({ ...s, [c.key]: !!v }))}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(0);
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow>
              {ALL_COLS.filter((c) => visibleCols[c.key]).map((c) => (
                <TableHead key={c.key}>
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label} <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map(({ lead }) => (
              <TableRow key={lead.id} className="cursor-pointer" onClick={() => onOpen(lead)}>
                {visibleCols.name && (
                  <TableCell className="max-w-40 truncate font-medium">{lead.name}</TableCell>
                )}
                {visibleCols.email && (
                  <TableCell className="max-w-50 truncate text-muted-foreground">
                    {lead.email}
                  </TableCell>
                )}
                {visibleCols.mobile && (
                  <TableCell className="money whitespace-nowrap">{lead.mobile}</TableCell>
                )}
                {visibleCols.source && (
                  <TableCell>
                    <SourceBadge source={lead.source} />
                  </TableCell>
                )}
                {visibleCols.agent && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={lead.assignedTo ?? "unassigned"}
                      onValueChange={(v) => onQuickAssign(lead.id, v)}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        {lead.assignedTo ? (
                          <AgentAvatar user={userById(lead.assignedTo)} showName size={5} />
                        ) : (
                          <SelectValue placeholder="Assign..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users
                          .filter((u) => u.role === "Agent")
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                {visibleCols.status && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={lead.status}
                      onValueChange={(v) => onQuickStatus(lead.id, v as Lead["status"])}
                    >
                      <SelectTrigger className="h-8 w-32.5 text-xs">
                        <StatusBadge status={lead.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                {visibleCols.createdAt && (
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {dateFmt(lead.createdAt)}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page {page + 1} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function FilterBar({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  return (
    <GlassCard className="mb-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0">
          <label className="mb-1 block text-xs text-muted-foreground">Status</label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ ...filters, status: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs text-muted-foreground">Source</label>
          <Select
            value={filters.source}
            onValueChange={(v) => setFilters({ ...filters, source: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs text-muted-foreground">Assigned agent</label>
          <Select value={filters.agent} onValueChange={(v) => setFilters({ ...filters, agent: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users
                .filter((u) => u.role === "Agent")
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 sm:col-span-2 lg:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">Created date range</label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters(defaultFilters)}
          className="gap-1.5"
        >
          <XCircle className="size-3.5" /> Reset filters
        </Button>
      </div>
    </GlassCard>
  );
}

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(seedLeads);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const loading = useFakeLoad(400);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filters.status !== "all" && l.status !== filters.status) return false;
      if (filters.source !== "all" && l.source !== filters.source) return false;
      if (filters.agent === "unassigned" && l.assignedTo) return false;
      if (
        filters.agent !== "all" &&
        filters.agent !== "unassigned" &&
        l.assignedTo !== filters.agent
      )
        return false;
      if (filters.from && new Date(l.createdAt) < new Date(filters.from)) return false;
      if (filters.to && new Date(l.createdAt) > new Date(filters.to)) return false;
      return true;
    });
  }, [leads, filters]);

  const updateLead = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const quickAssign = (id: string, agent: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, assignedTo: agent === "unassigned" ? undefined : agent } : l,
      ),
    );
    toast.success("Lead assigned", {
      description:
        agent === "unassigned" ? "Lead is now unassigned." : `Assigned to ${userById(agent).name}.`,
    });
  };

  const quickStatus = (id: string, status: Lead["status"]) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    toast.success("Status updated", { description: `Lead marked as ${status}.` });
  };

  return (
    <AppShell
      title="Leads"
      description="Leads captured from the public calculators, ready to assign and convert."
    >
      <FilterBar filters={filters} setFilters={setFilters} />
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <LeadsTable
            rows={filtered}
            onOpen={(l) => {
              setActiveLead(l);
              setSheetOpen(true);
            }}
            onQuickAssign={quickAssign}
            onQuickStatus={quickStatus}
          />
        </motion.div>
      )}
      <LeadSheet
        lead={activeLead}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={updateLead}
      />
    </AppShell>
  );
}
