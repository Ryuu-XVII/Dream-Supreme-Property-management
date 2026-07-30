import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, EmptyState, TableSkeleton } from "@/components/ui-kit";
import { AgentAvatar, StageBadge, StatusDot } from "@/components/badges";
import { STAGES, type Stage } from "@/data/state"; // STAGES is still fine as constants
import { zar, dateFmt, urgencyOf, type Urgency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { LayoutGrid, List, SlidersHorizontal, ArrowUpDown, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { usePipelineDeals, type PipelineDeal } from "@/data/deals";
import { useAgents, useBranches } from "@/data/reference";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Deal Pipeline | Dream Supreme Properties" },
      {
        name: "description",
        content: "Kanban and table view of all active deals through every transaction stage.",
      },
    ],
  }),
  component: PipelinePage,
});

const MIN_PRICE = 0;
const MAX_PRICE = 100_000_000_00; // R100m in cents

function mostUrgentTone(deal: PipelineDeal): Urgency {
  const open = deal.conditions.filter(
    (c: any) => c.status === "pending" || c.status === "extended",
  );
  if (open.length === 0) return "safe";
  const rank: Record<Urgency, number> = { lapsed: 0, critical: 1, warning: 2, safe: 3 };
  return open.reduce<Urgency>((acc, c: any) => {
    const days = Math.round((new Date(c.due_on).getTime() - Date.now()) / 86400000);
    const u = urgencyOf(days);
    return rank[u] < rank[acc] ? u : acc;
  }, "safe");
}

interface Filters {
  agent: string;
  branch: string;
  status: string;
  priceMin: number;
  priceMax: number;
  from: string;
  to: string;
}

const defaultFilters: Filters = {
  agent: "all",
  branch: "all",
  status: "all",
  priceMin: MIN_PRICE,
  priceMax: MAX_PRICE,
  from: "",
  to: "",
};

function useFilteredDeals(deals: PipelineDeal[] | undefined, filters: Filters) {
  return useMemo(() => {
    if (!deals) return [];
    return deals.filter((deal) => {
      if (filters.agent !== "all" && deal.agent.id !== filters.agent) return false;
      // if (filters.branch !== "all" && deal.branch !== filters.branch) return false; // Branch not fetched yet
      if (filters.status === "active" && deal.cancelled) return false;
      if (filters.status === "cancelled" && !deal.cancelled) return false;
      if (deal.salePrice < filters.priceMin || deal.salePrice > filters.priceMax) return false;
      if (filters.from && new Date(deal.stageSince) < new Date(filters.from)) return false;
      if (filters.to && new Date(deal.stageSince) > new Date(filters.to)) return false;
      return true;
    });
  }, [deals, filters]);
}

function FilterBar({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const { data: agents = [] } = useAgents();
  const { data: branches = [] } = useBranches();

  return (
    <GlassCard className="mb-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <SlidersHorizontal className="size-4" /> Filters
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <label className="mb-1 block text-xs text-muted-foreground">Agent</label>
          <Select value={filters.agent} onValueChange={(v) => setFilters({ ...filters, agent: v })}>
            <SelectTrigger>
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs text-muted-foreground">Branch</label>
          <Select
            value={filters.branch}
            onValueChange={(v) => setFilters({ ...filters, branch: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs text-muted-foreground">Status</label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ ...filters, status: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="cancelled">Cancelled / Lapsed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs text-muted-foreground">Stage-since date range</label>
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
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">
            Sale price range:{" "}
            <span className="money">{zar(filters.priceMin, { decimals: false })}</span> —{" "}
            <span className="money">{zar(filters.priceMax, { decimals: false })}</span>
          </label>
          <Slider
            min={MIN_PRICE}
            max={MAX_PRICE}
            step={500000}
            value={[filters.priceMin, filters.priceMax]}
            onValueChange={([min, max]) => setFilters({ ...filters, priceMin: min, priceMax: max })}
            className="mt-3"
          />
        </div>
        <div className="flex items-end lg:col-span-2 lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(defaultFilters)}
            className="gap-1.5"
          >
            <XCircle className="size-3.5" /> Reset filters
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function DealCard({ deal }: { deal: PipelineDeal }) {
  const navigate = useNavigate();
  const tone = mostUrgentTone(deal);
  return (
    <motion.div
      layout
      whileHover={{ y: -3 }}
      onClick={() => navigate({ to: "/deals/$dealId", params: { dealId: deal.id } })}
      className="lift cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] text-muted-foreground">{deal.ref}</span>
        <StatusDot tone={tone} />
      </div>
      <p className="mb-2 truncate text-sm font-medium" title={deal.property.address}>
        {deal.property.address}
      </p>
      <p className="money mb-2 text-sm font-semibold">{zar(deal.salePrice, { decimals: false })}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AgentAvatar user={{ name: deal.agent.name, colour: "#1f7a52" } as any} size={6} />
          <span className="text-[10px] text-muted-foreground truncate max-w-15">
            {deal.agent.name}
          </span>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {deal.daysInStage}d in stage
        </Badge>
      </div>
    </motion.div>
  );
}

function KanbanBoard({ filtered }: { filtered: PipelineDeal[] }) {
  const navigate = useNavigate();
  const active = filtered.filter((d) => !d.cancelled);
  const cancelled = filtered.filter((d) => d.cancelled);

  // Note: STAGES from mock uses specific names, Supabase enum is slightly different format.
  // Will map properly later if needed, but for now we assume deal.stage matches the UI STAGES or we'll just format it.
  const byStage = (stage: string) =>
    active.filter((d) => {
      // Map supabase enum to STAGES
      const mappedStage = d.stage.replace(/_/g, " ").toLowerCase();
      const uiStage = stage.toLowerCase();
      return (
        mappedStage === uiStage || mappedStage.includes(uiStage) || uiStage.includes(mappedStage)
      );
    });

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No deals match your filters"
        message="Try widening your filters or resetting them to see more deals."
      />
    );
  }

  return (
    <div>
      <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-3">
        {STAGES.map((stage) => {
          const stageDeals = byStage(stage);
          return (
            <div key={stage} className="w-70 shrink-0">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {stage}
                </h3>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {stageDeals.length}
                </Badge>
              </div>
              <div className="flex min-h-24 flex-col gap-2 rounded-xl bg-muted/40 p-2">
                {stageDeals.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                    No deals
                  </p>
                ) : (
                  stageDeals.map((deal) => <DealCard key={deal.id} deal={deal} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cancelled.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-destructive">
            <XCircle className="size-4" /> Cancelled / Lapsed ({cancelled.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cancelled.map((deal) => {
              return (
                <div
                  key={deal.id}
                  onClick={() => navigate({ to: "/deals/$dealId", params: { dealId: deal.id } })}
                  className="lift cursor-pointer rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {deal.ref}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive"
                    >
                      Cancelled
                    </Badge>
                  </div>
                  <p className="truncate text-sm font-medium">{deal.property.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {deal.cancelled?.reason} · {deal.cancelled && dateFmt(deal.cancelled.at)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type SortKey = "ref" | "address" | "stage" | "price" | "agent" | "days";
const ALL_COLS: { key: SortKey; label: string }[] = [
  { key: "ref", label: "Reference" },
  { key: "address", label: "Address" },
  { key: "stage", label: "Stage" },
  { key: "price", label: "Price" },
  { key: "agent", label: "Agent" },
  { key: "days", label: "Days in stage" },
];

function TableView({ filtered }: { filtered: PipelineDeal[] }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("days");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [visibleCols, setVisibleCols] = useState<Record<SortKey, boolean>>({
    ref: true,
    address: true,
    stage: true,
    price: true,
    agent: true,
    days: true,
  });

  const sorted = useMemo(() => {
    const withMeta = [...filtered];
    withMeta.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "ref":
          cmp = a.ref.localeCompare(b.ref);
          break;
        case "address":
          cmp = a.property.address.localeCompare(b.property.address);
          break;
        case "stage":
          cmp = a.stage.localeCompare(b.stage);
          break;
        case "price":
          cmp = a.salePrice - b.salePrice;
          break;
        case "agent":
          cmp = a.agent.name.localeCompare(b.agent.name);
          break;
        case "days":
          cmp = a.daysInStage - b.daysInStage;
          break;
      }
      return cmp * sortDir;
    });
    return withMeta;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No deals match your filters"
        message="Try widening your filters or resetting them to see more deals."
      />
    );
  }

  return (
    <GlassCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{sorted.length} deals</p>
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
            {pageRows.map((deal) => (
              <TableRow
                key={deal.id}
                className="cursor-pointer"
                onClick={() => navigate({ to: "/deals/$dealId", params: { dealId: deal.id } })}
              >
                {visibleCols.ref && <TableCell className="font-mono text-xs">{deal.ref}</TableCell>}
                {visibleCols.address && (
                  <TableCell className="max-w-55 truncate">{deal.property.address}</TableCell>
                )}
                {visibleCols.stage && (
                  <TableCell>
                    <StageBadge stage={deal.stage as Stage} />
                  </TableCell>
                )}
                {visibleCols.price && (
                  <TableCell className="money">
                    {zar(deal.salePrice, { decimals: false })}
                  </TableCell>
                )}
                {visibleCols.agent && <TableCell className="truncate">{deal.agent.name}</TableCell>}
                {visibleCols.days && <TableCell>{deal.daysInStage}d</TableCell>}
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

function PipelinePage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  const { data: deals, isLoading } = usePipelineDeals();
  const filtered = useFilteredDeals(deals, filters);

  return (
    <AppShell
      title="Deal Pipeline"
      description="Track every deal from mandate to registration."
      actions={
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as "kanban" | "table")}
        >
          <ToggleGroupItem value="kanban" aria-label="Kanban view" className="gap-1.5">
            <LayoutGrid className="size-4" /> Kanban
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="gap-1.5">
            <List className="size-4" /> Table
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <FilterBar filters={filters} setFilters={setFilters} />
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : view === "kanban" ? (
        <KanbanBoard filtered={filtered} />
      ) : (
        <TableView filtered={filtered} />
      )}
    </AppShell>
  );
}
