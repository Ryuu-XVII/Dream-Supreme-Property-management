import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, List, Plus, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, GlassCard, TableSkeleton } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { usePipelineDeals } from "@/data/deals";
import { useAgents } from "@/data/reference";
import { dateFmt, zar } from "@/lib/format";
import { stageFromDb } from "@/lib/domain";

export const Route = createFileRoute("/pipeline")({
  head: () => ({ meta: [{ title: "Deal Pipeline | Dream Supreme Properties" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const pipeline = usePipelineDeals();
  const agentQuery = useAgents();
  const [view, setView] = useState<"board" | "table">("board");
  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const deals = useMemo(() => pipeline.data ?? [], [pipeline.data]);
  const agents = agentQuery.data ?? [];

  const filtered = useMemo(
    () =>
      deals.filter((deal) => {
        if (agent !== "all" && deal.agent.id !== agent) return false;
        if (status === "active" && deal.cancelled) return false;
        if (status === "cancelled" && !deal.cancelled) return false;
        if (search) {
          const query = search.toLowerCase();
          const haystack =
            `${deal.ref} ${deal.property.address} ${deal.property.suburb} ${deal.agent.name}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [agent, deals, search, status],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const deal of filtered) {
      const stage = stageFromDb[deal.stage] ?? deal.stage;
      groups.set(stage, [...(groups.get(stage) ?? []), deal]);
    }
    return [...groups.entries()];
  }, [filtered]);

  return (
    <AppShell
      title="Deal Pipeline"
      description="Live deals from the agency database."
      actions={
        <Button asChild>
          <Link to="/deals/new">
            <Plus className="size-4" /> New deal
          </Link>
        </Button>
      }
    >
      <GlassCard className="mb-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="size-4" /> Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, address, or agent"
          />
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger>
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} deals</p>
        <div className="flex rounded-lg border p-1">
          <Button
            size="sm"
            variant={view === "board" ? "secondary" : "ghost"}
            onClick={() => setView("board")}
          >
            <LayoutGrid className="size-4" /> Board
          </Button>
          <Button
            size="sm"
            variant={view === "table" ? "secondary" : "ghost"}
            onClick={() => setView("table")}
          >
            <List className="size-4" /> Table
          </Button>
        </div>
      </div>

      {pipeline.isLoading ? (
        <TableSkeleton rows={6} />
      ) : pipeline.isError ? (
        <GlassCard>
          <EmptyState
            title="Pipeline unavailable"
            message={
              pipeline.error instanceof Error ? pipeline.error.message : "Could not load deals."
            }
          />
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            title="No matching deals"
            message="Try changing the filters or create a new deal."
          />
        </GlassCard>
      ) : view === "table" ? (
        <GlassCard className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <Link
                      to="/deals/$dealId"
                      params={{ dealId: deal.id }}
                      className="font-mono text-primary hover:underline"
                    >
                      {deal.ref}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {deal.property.address}
                    <span className="block text-xs text-muted-foreground">
                      {deal.property.suburb}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{stageFromDb[deal.stage] ?? deal.stage}</Badge>
                  </TableCell>
                  <TableCell>{deal.agent.name}</TableCell>
                  <TableCell>{zar(deal.salePrice)}</TableCell>
                  <TableCell>{dateFmt(deal.stageSince)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {grouped.map(([stage, stageDeals]) => (
            <section key={stage} className="w-80 shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{stage}</h2>
                <Badge variant="secondary">{stageDeals.length}</Badge>
              </div>
              <div className="space-y-3">
                {stageDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    to="/deals/$dealId"
                    params={{ dealId: deal.id }}
                    className="block"
                  >
                    <GlassCard className="transition-colors hover:border-primary/40">
                      <div className="flex justify-between gap-2">
                        <span className="font-mono text-xs text-primary">{deal.ref}</span>
                        <span className="text-xs text-muted-foreground">{deal.daysInStage}d</span>
                      </div>
                      <p className="mt-2 font-medium">{deal.property.address}</p>
                      <p className="text-xs text-muted-foreground">{deal.property.suburb}</p>
                      <div className="mt-3 flex justify-between text-sm">
                        <span>{deal.agent.name}</span>
                        <span className="font-medium">{zar(deal.salePrice)}</span>
                      </div>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
