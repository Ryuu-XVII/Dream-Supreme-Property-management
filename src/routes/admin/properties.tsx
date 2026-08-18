import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard, EmptyState, KpiCard } from "@/components/ui-kit";
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
import { Search, MapPin, Building2, TrendingUp, Clock, History, Loader2 } from "lucide-react";
import { useAdminProperties } from "@/data/properties";
import { zar } from "@/lib/format";
import { Property24ListingsTable } from "@/components/property24/property24-listings-table";

export const Route = createFileRoute("/admin/properties")({
  component: AdminProperties,
});

function AdminProperties() {
  const { data: propertyList = [], isLoading } = useAdminProperties();
  const [search, setSearch] = useState("");

  const filteredProperties = propertyList.filter(
    (p) =>
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.agent.toLowerCase().includes(search.toLowerCase()),
  );

  // These KPIs previously matched on "Available"/"Under Offer", which are not
  // values this data ever carries: useAdminProperties derives status from the
  // deal (active/registered/cancelled/lapsed/archived) or falls back to
  // "mandated"/"unlisted". Nothing matched, so all three tiles always read
  // zero even with live stock on the table below.
  const ON_MARKET_STATUSES = new Set(["active", "mandated"]);
  const activeProperties = propertyList.filter((p) =>
    ON_MARKET_STATUSES.has((p.status ?? "").toLowerCase()),
  );
  const totalValue = activeProperties.reduce((acc, curr) => acc + curr.price, 0);
  const avgDaysOnMarket = Math.round(
    activeProperties.reduce((acc, curr) => acc + curr.daysOnMarket, 0) /
      (activeProperties.length || 1),
  );

  return (
    <>
      <AdminPageHeader
        title="Property Portfolio Oversight"
        description="Read-only auditing and oversight view of all agency listings and agent performance."
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Active Portfolio Value"
            value={`R ${(totalValue / 100 / 1_000_000).toFixed(1)}M`}
            sub="Currently on market"
            icon={TrendingUp}
            delay={0}
          />
          <KpiCard
            label="Active Listings"
            value={activeProperties.length}
            sub="Across all agents"
            icon={Building2}
            delay={0.05}
          />
          <KpiCard
            label="Avg Days on Market"
            value={avgDaysOnMarket}
            sub="For active properties"
            icon={Clock}
            delay={0.1}
          />
        </div>

        <GlassCard className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/50">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by address or agent..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border/50"
              />
            </div>
            <div className="flex gap-2">
              <span className="text-xs font-medium px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-500/20 flex items-center gap-1.5">
                <History className="size-3" /> Audit Trail View
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="p-8">
              <EmptyState title="No properties found" message="Try adjusting your search query." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Address</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Price (ZAR)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>DOM</TableHead>
                    <TableHead>Latest Audit Event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProperties.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 text-indigo-500" />
                          <div className="flex flex-col">
                            <span
                              className="font-medium text-sm max-w-62.5 truncate"
                              title={p.address}
                            >
                              {p.address}
                            </span>
                            <span className="text-xs text-muted-foreground">{p.type}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{p.agent}</TableCell>
                      {/* `price` is *cents* (sale_price_cents /
                          listing_price_cents). Rendering it raw overstated
                          every property by 100x — R2 500 000 showed as
                          R250 000 000. */}
                      <TableCell className="font-mono text-sm tabular-nums">
                        {zar(p.price, { decimals: false })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.status === "Available"
                              ? "default"
                              : p.status === "Sold"
                                ? "secondary"
                                : "outline"
                          }
                          className={
                            p.status === "Available"
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0"
                              : ""
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{p.daysOnMarket}</span>
                        <span className="text-xs text-muted-foreground ml-1">days</span>
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-50 truncate"
                        title={p.lastAudit || "None"}
                      >
                        {p.lastAudit || "Property created in system"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

        <Property24ListingsTable />
      </div>
    </>
  );
}
