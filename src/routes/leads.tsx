import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, GlassCard, TableSkeleton } from "@/components/ui-kit";
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
import { useLeads, useUpdateLead } from "@/data/leads";
import { useAgents } from "@/data/reference";
import { dateFmt } from "@/lib/format";

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Leads | Dream Supreme Properties" }] }),
  component: LeadsPage,
});

const statuses = ["new", "contacted", "qualified", "converted", "closed"];

function LeadsPage() {
  const leadsQuery = useLeads();
  const agentsQuery = useAgents();
  const updateLead = useUpdateLead();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const agents = agentsQuery.data ?? [];
  const filtered = useMemo(
    () =>
      leads.filter((lead) => {
        if (status !== "all" && lead.status !== status) return false;
        if (
          search &&
          !`${lead.name} ${lead.email} ${lead.mobile} ${lead.source}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [leads, search, status],
  );

  async function save(id: string, updates: { status?: string; assignedTo?: string | null }) {
    try {
      await updateLead.mutateAsync({ id, ...updates });
      toast.success("Lead updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update lead");
    }
  }

  return (
    <AppShell
      title="Leads"
      description="Live calculator and enquiry leads, ready to assign and convert."
    >
      <GlassCard className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search leads"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {item[0].toUpperCase() + item.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>
      {leadsQuery.isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : leadsQuery.isError ? (
        <GlassCard>
          <EmptyState
            title="Leads unavailable"
            message={
              leadsQuery.error instanceof Error ? leadsQuery.error.message : "Could not load leads."
            }
          />
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState title="No leads found" message="New public enquiries will appear here." />
        </GlassCard>
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Assigned agent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
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
                      onValueChange={(value) =>
                        void save(lead.id, { assignedTo: value === "unassigned" ? null : value })
                      }
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
                      onValueChange={(value) => void save(lead.id, { status: value })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item[0].toUpperCase() + item.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
      {updateLead.isPending && <p className="mt-3 text-xs text-muted-foreground">Saving lead…</p>}
    </AppShell>
  );
}
