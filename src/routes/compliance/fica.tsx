import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";
import { GlassCard, TableSkeleton, useFakeLoad, EmptyState } from "@/components/ui-kit";
import { FicaBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dateTimeFmt } from "@/lib/format";
import { deals, type Party } from "@/data/mock";
import { ChevronDown, ChevronRight, UploadCloud, ShieldCheck, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/compliance/fica")({
  component: FicaRegister,
  head: () => ({
    meta: [
      { title: "FICA Register | Dream Supreme Properties" },
      { name: "description", content: "FICA compliance and POPIA consent register for every party across all deals." },
      { property: "og:title", content: "FICA Register | Dream Supreme Properties" },
      { property: "og:description", content: "FICA compliance and POPIA consent register for every party across all deals." },
    ],
  }),
});

interface PartyRow {
  party: Party;
  dealRef: string;
  dealId: string;
}

function FicaRegister() {
  const loading = useFakeLoad(400);
  const [entityFilter, setEntityFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checklistState, setChecklistState] = useState<Record<string, boolean[]>>({});
  const [popiaState, setPopiaState] = useState<Record<string, boolean>>({});

  const allRows: PartyRow[] = useMemo(
    () => deals.flatMap((d) => d.parties.map((p) => ({ party: p, dealRef: d.ref, dealId: d.id }))),
    [],
  );

  const entityTypes = useMemo(() => Array.from(new Set(allRows.map((r) => r.party.entityType))), [allRows]);

  const rows = useMemo(
    () => allRows.filter((r) => entityFilter === "all" || r.party.entityType === entityFilter),
    [allRows, entityFilter],
  );

  function toggleChecklist(partyId: string, idx: number, base: boolean[]) {
    setChecklistState((prev) => {
      const current = prev[partyId] ?? base;
      const next = current.map((v, i) => (i === idx ? !v : v));
      return { ...prev, [partyId]: next };
    });
  }

  function popiaFor(party: Party) {
    return popiaState[party.id] ?? party.popia;
  }

  return (
    <AppShell
      title="FICA Register"
      description="Every party across every deal, with FICA checklist status and POPIA consent."
      crumbs={[{ label: "Compliance" }, { label: "FICA Register" }]}
    >
      <ComplianceTabs />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entity types</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rows.length} parties</span>
      </div>

      <GlassCard className="p-0">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No parties found" message="Adjust the entity type filter to see FICA parties." />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Party type</TableHead>
                  <TableHead>Entity type</TableHead>
                  <TableHead>FICA status</TableHead>
                  <TableHead>POPIA consent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ party, dealRef, dealId }) => {
                  const isOpen = !!expanded[party.id];
                  const checklist = checklistState[party.id] ?? party.checklist.map((c) => c.done);
                  return (
                    <>
                      <TableRow
                        key={party.id}
                        className="cursor-pointer"
                        onClick={() => setExpanded((p) => ({ ...p, [party.id]: !p[party.id] }))}
                      >
                        <TableCell>
                          {isOpen ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{party.name}</TableCell>
                        <TableCell>
                          <Link
                            to="/deals/$id"
                            params={{ id: dealId }}
                            className="money text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {dealRef}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{party.side}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{party.entityType}</TableCell>
                        <TableCell>
                          <FicaBadge status={party.fica} />
                        </TableCell>
                        <TableCell>
                          {popiaFor(party) ? (
                            <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success">
                              <ShieldCheck className="size-3" /> Consented
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/10 text-destructive">
                              <ShieldOff className="size-3" /> No consent
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow key={`${party.id}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          <Collapsible open={isOpen}>
                            <CollapsibleContent>
                              <div className="grid gap-6 border-t border-border bg-muted/30 p-5 sm:grid-cols-2">
                                <div>
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    FICA checklist
                                  </p>
                                  <div className="space-y-2.5">
                                    {party.checklist.map((c, idx) => (
                                      <div key={c.label} className="flex items-center justify-between gap-3">
                                        <label className="flex min-w-0 items-center gap-2 text-sm">
                                          <Checkbox
                                            checked={checklist[idx]}
                                            onCheckedChange={() => toggleChecklist(party.id, idx, party.checklist.map((x) => x.done))}
                                          />
                                          <span className="truncate">{c.label}</span>
                                        </label>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 shrink-0 gap-1"
                                          onClick={() =>
                                            toast.success("Document uploaded", { description: `${c.label} · ${party.name}` })
                                          }
                                        >
                                          <UploadCloud className="size-3.5" /> Upload
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    POPIA consent
                                  </p>
                                  <GlassCard className="space-y-3 p-4">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">Consent to process personal information</span>
                                      <Switch
                                        checked={popiaFor(party)}
                                        onCheckedChange={(v) => {
                                          setPopiaState((prev) => ({ ...prev, [party.id]: v }));
                                          toast.success(v ? "POPIA consent recorded" : "POPIA consent withdrawn", {
                                            description: party.name,
                                          });
                                        }}
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Purpose: processing of identity verification, FICA compliance, and transaction
                                      documentation for the sale of immovable property in accordance with POPIA
                                      section 11.
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {party.popiaAt
                                        ? `Consent captured ${dateTimeFmt(party.popiaAt)}`
                                        : "No consent timestamp on record"}
                                    </p>
                                  </GlassCard>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </AppShell>
  );
}
