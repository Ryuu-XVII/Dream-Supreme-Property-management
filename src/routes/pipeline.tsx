import { memo, useCallback, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, List, Plus, SlidersHorizontal, Users2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePipelineDeals, type PipelineDeal } from "@/data/deals";
import { useLeads, useUpdateLead, type LeadRecord } from "@/data/leads";
import { useAgents } from "@/data/reference";
import { QuickDealModal } from "@/components/deal/quick-deal-modal";
import { dateFmt, zar } from "@/lib/format";
import { STAGES } from "@/types";
import { supabase } from "@/lib/supabase";
import { stageFromDb, stageToDb } from "@/lib/domain";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pipeline")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({ meta: [{ title: "Deal Flow | Dream Supreme Properties" }] }),
  component: DealFlowPage,
});

const leadStatuses = ["new", "contacted", "qualified", "converted", "closed"];

const DealTableRow = memo(function DealTableRow({ deal }: { deal: PipelineDeal }) {
  return (
    <TableRow>
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
        <span className="block text-xs text-muted-foreground">{deal.property.suburb}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{stageFromDb[deal.stage] ?? deal.stage}</Badge>
      </TableCell>
      <TableCell>{deal.agent.name}</TableCell>
      <TableCell className="font-semibold">{zar(deal.salePrice)}</TableCell>
      <TableCell>{dateFmt(deal.stageSince)}</TableCell>
    </TableRow>
  );
});

const DealCard = memo(function DealCard({
  deal,
  isReadOnly,
  onStageChange,
}: {
  deal: PipelineDeal;
  isReadOnly: boolean;
  onStageChange: (deal: PipelineDeal, newStageDb: string) => void;
}) {
  return (
    <Link to="/deals/$dealId" params={{ dealId: deal.id }} className="block">
      <GlassCard className="transition-colors hover:border-primary/40">
        <div className="flex justify-between gap-2">
          <span className="font-mono text-xs text-primary">{deal.ref}</span>
          <span className="text-xs text-muted-foreground">{deal.daysInStage}d</span>
        </div>
        <p className="mt-2 font-medium">{deal.property.address}</p>
        <p className="text-xs text-muted-foreground">{deal.property.suburb}</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="truncate max-w-28 text-muted-foreground">{deal.agent.name}</span>
          <span className="font-semibold text-foreground">{zar(deal.salePrice)}</span>
        </div>
        <div
          className="mt-3 border-t border-border/40 pt-2 flex items-center justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] font-medium text-muted-foreground">Move Stage:</span>
          <Select
            value={deal.stage}
            disabled={isReadOnly}
            onValueChange={(newStageDb) => onStageChange(deal, newStageDb)}
          >
            <SelectTrigger className="h-7 text-[11px] w-36 px-2 py-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={stageToDb[s] || s} className="text-xs">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>
    </Link>
  );
});

const LeadTableRow = memo(function LeadTableRow({
  lead,
  agents,
  isReadOnly,
  onAssign,
  onStatusChange,
}: {
  lead: LeadRecord;
  agents: { id: string; full_name: string }[];
  isReadOnly: boolean;
  onAssign: (leadId: string, agentId: string | null) => void;
  onStatusChange: (leadId: string, status: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {lead.name}
        {lead.message && (
          <span className="block max-w-64 truncate text-xs text-muted-foreground">
            {lead.message}
          </span>
        )}
      </TableCell>
      <TableCell>
        {lead.email || "—"}
        <span className="block text-xs text-muted-foreground">{lead.mobile}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{lead.source}</Badge>
      </TableCell>
      <TableCell>{dateFmt(lead.createdAt)}</TableCell>
      <TableCell>
        <Select
          value={lead.assignedTo ?? "unassigned"}
          disabled={isReadOnly}
          onValueChange={(value) => onAssign(lead.id, value === "unassigned" ? null : value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={lead.status}
          disabled={isReadOnly}
          onValueChange={(value) => onStatusChange(lead.id, value)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {leadStatuses.map((item) => (
              <SelectItem key={item} value={item}>
                {item[0].toUpperCase() + item.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <Button asChild size="sm" variant="ghost" className="gap-1 text-xs">
          <Link to="/deals/new">
            Convert to Deal <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
});

function DealFlowPage() {
  const { tab: rawTab } = Route.useSearch();
  const currentTab = rawTab ?? "pipeline";
  const navigate = useNavigate({ from: Route.id });
  const { isReadOnly } = useAuth();
  const pipeline = usePipelineDeals();
  const leadsQuery = useLeads();
  const agentQuery = useAgents();
  const updateLead = useUpdateLead();

  const [view, setView] = useState<"board" | "table">("board");
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [agentFilter, setAgentFilter] = useState("all");
  const [dealStatusFilter, setDealStatusFilter] = useState("active");
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const deals = useMemo(() => pipeline.data ?? [], [pipeline.data]);
  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const agents = agentQuery.data ?? [];

  // Filter Deals
  const filteredDeals = useMemo(
    () =>
      deals.filter((deal) => {
        if (agentFilter !== "all" && deal.agent.id !== agentFilter) return false;
        if (dealStatusFilter === "active" && deal.cancelled) return false;
        if (dealStatusFilter === "cancelled" && !deal.cancelled) return false;
        if (search) {
          const query = search.toLowerCase();
          const haystack =
            `${deal.ref} ${deal.property.address} ${deal.property.suburb} ${deal.agent.name}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [agentFilter, deals, search, dealStatusFilter],
  );

  // Group Deals by Stage for Kanban Board
  const groupedDeals = useMemo(() => {
    const groups = new Map<string, typeof filteredDeals>();
    for (const deal of filteredDeals) {
      const stage = stageFromDb[deal.stage] ?? deal.stage;
      groups.set(stage, [...(groups.get(stage) ?? []), deal]);
    }
    return [...groups.entries()];
  }, [filteredDeals]);

  // Filter Leads
  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (leadStatusFilter !== "all" && lead.status !== leadStatusFilter) return false;
        if (agentFilter !== "all" && lead.assignedTo !== agentFilter) return false;
        if (
          search &&
          !`${lead.name} ${lead.email} ${lead.mobile} ${lead.source}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [leads, search, leadStatusFilter, agentFilter],
  );

  // Metrics
  const activePipelineValue = useMemo(
    () => filteredDeals.reduce((sum, d) => sum + (d.salePrice || 0), 0),
    [filteredDeals],
  );
  const unassignedLeadsCount = useMemo(
    () => leads.filter((l) => !l.assignedTo && l.status !== "closed").length,
    [leads],
  );

  const handleSaveLead = useCallback(
    async (id: string, updates: { status?: string; assignedTo?: string | null }) => {
      if (isReadOnly) return toast.info("Read-only mode: exit impersonation to edit leads.");
      try {
        await updateLead.mutateAsync({ id, ...updates });
        toast.success("Lead updated");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update lead");
      }
    },
    [isReadOnly, updateLead],
  );

  const handleAssignLead = useCallback(
    (leadId: string, agentId: string | null) =>
      void handleSaveLead(leadId, { assignedTo: agentId }),
    [handleSaveLead],
  );

  const handleLeadStatusChange = useCallback(
    (leadId: string, status: string) => void handleSaveLead(leadId, { status }),
    [handleSaveLead],
  );

  const handleStageChange = useCallback(
    async (deal: PipelineDeal, newStageDb: string) => {
      if (isReadOnly) {
        toast.info("Read-only mode: exit impersonation to move deals.");
        return;
      }
      try {
        const { error } = await supabase.rpc("transition_deal", {
          p_deal_id: deal.id,
          p_to_stage: newStageDb,
          p_reason: "Updated from Kanban board",
          p_override: false,
        });
        if (error) {
          if (error.message.includes("GATE_FAILED")) {
            toast.error(error.message.replace("GATE_FAILED: ", ""));
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success(`Deal ${deal.ref} moved to next stage`);
        void pipeline.refetch();
      } catch (err: any) {
        toast.error(err.message || "Failed to update deal stage");
      }
    },
    [isReadOnly, pipeline],
  );

  return (
    <AppShell
      title="Deal Flow"
      description="Unified workspace for incoming leads, client inquiries, and active transaction pipelines."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={isReadOnly} onClick={() => setQuickCaptureOpen(true)}>
            <Plus className="size-4" /> Quick Deal
          </Button>
          <Button
            asChild
            disabled={isReadOnly}
            className={isReadOnly ? "pointer-events-none opacity-50" : undefined}
          >
            {isReadOnly ? (
              <span>
                <Plus className="size-4" /> Full Deal Wizard
              </span>
            ) : (
              <Link to="/deals/new">
                <Plus className="size-4" /> Full Deal Wizard
              </Link>
            )}
          </Button>
        </div>
      }
    >
      {/* Metric Summary Bar */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Deals
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {filteredDeals.length}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Pipeline Volume
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">
            {zar(activePipelineValue)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Unassigned Enquiries
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-500">
            {unassignedLeadsCount}
          </p>
        </GlassCard>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(val) => void navigate({ search: { tab: val } })}
        className="w-full"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value="pipeline" className="gap-2">
              <LayoutGrid className="size-4" /> Deal Pipeline
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2">
              <Users2 className="size-4" /> Incoming Leads ({leads.length})
            </TabsTrigger>
          </TabsList>

          {currentTab === "pipeline" && (
            <div className="flex items-center justify-end gap-2">
              <p className="text-xs text-muted-foreground hidden sm:block">
                {filteredDeals.length} deals
              </p>
              <div className="flex rounded-lg border p-1 bg-background/50">
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
          )}
        </div>

        {/* Global Filter Bar */}
        <GlassCard className="mb-5">
          <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Filter Opportunities
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                currentTab === "leads"
                  ? "Search name, email, mobile, source..."
                  : "Search ref, address, suburb..."
              }
            />
            <Select value={agentFilter} onValueChange={setAgentFilter}>
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

            {currentTab === "pipeline" ? (
              <Select value={dealStatusFilter} onValueChange={setDealStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active Deals</SelectItem>
                  <SelectItem value="cancelled">Cancelled Deals</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All lead statuses</SelectItem>
                  {leadStatuses.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st[0].toUpperCase() + st.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </GlassCard>

        {/* PIPELINE TAB CONTENT */}
        <TabsContent value="pipeline" className="mt-0">
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
          ) : filteredDeals.length === 0 ? (
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
                  {filteredDeals.map((deal) => (
                    <DealTableRow key={deal.id} deal={deal} />
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {groupedDeals.map(([stage, stageDeals]) => (
                <section key={stage} className="w-80 shrink-0">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{stage}</h2>
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        isReadOnly={isReadOnly}
                        onStageChange={handleStageChange}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LEADS TAB CONTENT */}
        <TabsContent value="leads" className="mt-0">
          {leadsQuery.isLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : leadsQuery.isError ? (
            <GlassCard>
              <EmptyState
                title="Leads unavailable"
                message={
                  leadsQuery.error instanceof Error
                    ? leadsQuery.error.message
                    : "Could not load leads."
                }
              />
            </GlassCard>
          ) : filteredLeads.length === 0 ? (
            <GlassCard>
              <EmptyState
                title="No leads found"
                message="New website and calculator enquiries will appear here."
              />
            </GlassCard>
          ) : (
            <GlassCard className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <LeadTableRow
                      key={lead.id}
                      lead={lead}
                      agents={agents}
                      isReadOnly={isReadOnly}
                      onAssign={handleAssignLead}
                      onStatusChange={handleLeadStatusChange}
                    />
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          )}
          {updateLead.isPending && (
            <p className="mt-3 text-xs text-muted-foreground">Saving lead changes…</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Deal Capture Modal */}
      <QuickDealModal
        open={quickCaptureOpen}
        onOpenChange={setQuickCaptureOpen}
        onSuccess={() => void pipeline.refetch()}
      />
    </AppShell>
  );
}
