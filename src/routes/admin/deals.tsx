import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, History, Loader2 } from "lucide-react";
import { dateFmt } from "@/lib/format";
import { stageFromDb } from "@/lib/domain";
import { usePipelineDeals, type PipelineDeal } from "@/data/deals";

export const Route = createFileRoute("/admin/deals")({
  component: AdminDeals,
});

function AdminDeals() {
  const { data: deals = [], isLoading } = usePipelineDeals();
  const [search, setSearch] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);

  const filteredDeals = deals.filter(
    (d) =>
      d.property?.address?.toLowerCase().includes(search.toLowerCase()) ||
      d.ref.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <AdminPageHeader
        title="Deals Management"
        description="View all active and historical deals and their timelines."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-0 overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-border flex items-center gap-4 bg-card/50">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference or address..."
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
          ) : filteredDeals.length === 0 ? (
            <div className="p-8">
              <EmptyState title="No deals found" message="Try adjusting your search query." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Reference</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Value (ZAR)</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedDeal(d)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-indigo-500" />
                          <span className="font-mono text-sm">{d.ref}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="font-medium max-w-50 truncate"
                        title={d.property?.address}
                      >
                        {d.property?.address || "No Address"}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        R {d.salePrice.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        >
                          {stageFromDb[d.stage] ?? d.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dateFmt(d.stageSince)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

        <div className="lg:col-span-1">
          {selectedDeal ? (
            <div className="space-y-4">
              <GlassCard>
                <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
                  <FileText className="size-4 text-primary" /> {selectedDeal.ref} Summary
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    <p className="text-sm font-medium">{selectedDeal.property?.address || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Agent</p>
                    <p className="text-sm font-medium">
                      {selectedDeal.agent?.name || "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Value</p>
                    <p className="text-sm font-medium text-emerald-600">
                      R {selectedDeal.salePrice.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium">{selectedDeal.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Days in Stage</p>
                    <p className="text-sm font-medium">{selectedDeal.daysInStage}</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          ) : (
            <GlassCard className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground h-full min-h-75">
              <History className="size-12 mb-4 opacity-20" />
              <p>Select a deal to view its details.</p>
            </GlassCard>
          )}
        </div>
      </div>
    </>
  );
}
