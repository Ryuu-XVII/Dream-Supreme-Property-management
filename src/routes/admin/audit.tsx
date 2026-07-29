import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Search, Activity, History, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateTimeFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useAuditLogs } from "@/data/audit";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAuditLog,
});

function getSeverityTone(action: string) {
  const highRisk = ["DELETE", "DROP", "COMMISSION_CHANGE", "RETIRE"];
  const mediumRisk = ["UPDATE", "STATUS_CHANGE", "OVERRIDE"];

  if (highRisk.some((r) => action.toUpperCase().includes(r))) {
    return "bg-red-500/10 text-red-600 border-red-500/20";
  }
  if (mediumRisk.some((r) => action.toUpperCase().includes(r))) {
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  }
  return "bg-slate-500/10 text-slate-600 border-slate-500/20";
}

function AdminAuditLog() {
  const { data: logs = [], isLoading } = useAuditLogs();
  const [search, setSearch] = useState("");

  const filteredLogs = logs.filter(
    (log) =>
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.entity.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <AdminPageHeader
        title="Agent Activity Audit"
        description="Track the history of agent actions like property status updates or commission changes to ensure compliance and oversight."
      />

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-4 bg-card/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by agent, action, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 border-border/50"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No activity found"
              message="Try adjusting your search query."
              icon={<History className="size-8 text-muted-foreground" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[180px]">Date & Time</TableHead>
                  <TableHead className="w-[200px]">Actor / System</TableHead>
                  <TableHead className="w-[200px]">Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-[100px] text-right">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {dateTimeFmt(log.timestamp)}
                    </TableCell>
                    <TableCell className="font-medium">{log.actor}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{log.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.entity} ({log.entityId.substring(0, 8)})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-sm max-w-[300px] truncate"
                      title={log.details}
                    >
                      {log.details}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={getSeverityTone(log.action)}>
                        {getSeverityTone(log.action).includes("red")
                          ? "HIGH"
                          : getSeverityTone(log.action).includes("amber")
                            ? "MEDIUM"
                            : "LOW"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </>
  );
}
