import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";
import { GlassCard, TableSkeleton, EmptyState } from "@/components/ui-kit";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateTimeFmt } from "@/lib/format";
import type { Party } from "@/types";
import { supabase } from "@/lib/supabase";
import { ChevronDown, ChevronRight, UploadCloud, ShieldCheck, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/compliance/fica")({
  component: FicaRegister,
  head: () => ({
    meta: [
      { title: "FICA Register | Dream Supreme Properties" },
      {
        name: "description",
        content: "FICA compliance and POPIA consent register for every party across all deals.",
      },
      { property: "og:title", content: "FICA Register | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "FICA compliance and POPIA consent register for every party across all deals.",
      },
    ],
  }),
});

interface PartyRow {
  party: Party;
  dealRef: string;
  dealId: string;
}

function FicaRegister() {
  const queryClient = useQueryClient();
  const ficaQuery = useQuery({
    queryKey: ["fica-register"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deal_party").select(`
        role,
        deal:deal_id(id, reference),
        party:party_id(
          id, full_name, party_type, entity_type, fica_status, popia_consent_at,
          documents:document(id, category, uploaded_at)
        )
      `);
      if (error) throw error;
      const entityNames: Record<string, string> = {
        natural_person: "Natural Person",
        company: "Company",
        close_corporation: "Close Corporation",
        trust: "Trust",
        deceased_estate: "Deceased Estate",
      };
      const ficaNames: Record<string, string> = {
        complete: "Complete",
        partial: "Partial",
        expired: "Expired",
        not_started: "Not Started",
      };
      return (data || []).map((row: any): PartyRow => {
        const documents = row.party?.documents || [];
        const checklist = [
          { label: "Identity document", categories: ["fica_id"] },
          { label: "Proof of address", categories: ["fica_proof_of_address"] },
          { label: "Bank statement", categories: ["fica_bank_statement"] },
        ].map((item) => ({
          label: item.label,
          done: documents.some((document: any) => item.categories.includes(document.category)),
        }));
        return {
          dealId: row.deal.id,
          dealRef: row.deal.reference,
          party: {
            id: row.party.id,
            name: row.party.full_name,
            side: row.role === "purchaser" ? "Purchaser" : "Seller",
            entityType: entityNames[row.party.entity_type] || row.party.entity_type,
            fica: ficaNames[row.party.fica_status] || "Not Started",
            popia: !!row.party.popia_consent_at,
            popiaAt: row.party.popia_consent_at,
            checklist,
          } as Party,
        };
      });
    },
  });
  const loading = ficaQuery.isLoading;
  const [entityFilter, setEntityFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [popiaState, setPopiaState] = useState<Record<string, boolean>>({});

  const allRows: PartyRow[] = useMemo(() => ficaQuery.data || [], [ficaQuery.data]);

  const entityTypes = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.party.entityType))),
    [allRows],
  );

  const rows = useMemo(
    () => allRows.filter((r) => entityFilter === "all" || r.party.entityType === entityFilter),
    [allRows, entityFilter],
  );

  function popiaFor(party: Party) {
    return popiaState[party.id] ?? party.popia;
  }

  return (
    <AppShell
      title="FICA Register"
      description="FICA compliance and POPIA consent register for every party across all deals."
      crumbs={[{ label: "Compliance" }, { label: "FICA Register" }]}
    >
      <ComplianceTabs />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-9 w-50">
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
            <EmptyState
              title="No parties found"
              message="Adjust the entity type filter to see FICA parties."
            />
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
                  const checklist = party.checklist.map((c) => c.done);
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
                            to="/deals/$dealId"
                            params={{ dealId: dealId }}
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
                            <Badge
                              variant="outline"
                              className="gap-1 border-success/30 bg-success/10 text-success"
                            >
                              <ShieldCheck className="size-3" /> Consented
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-destructive/30 bg-destructive/10 text-destructive"
                            >
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
                                      <div
                                        key={c.label}
                                        className="flex items-center justify-between gap-3"
                                      >
                                        <label className="flex min-w-0 items-center gap-2 text-sm">
                                          <Checkbox
                                            checked={checklist[idx]}
                                            onCheckedChange={() =>
                                              toast.info(
                                                "Checklist status is set by uploaded documents.",
                                              )
                                            }
                                          />
                                          <span className="truncate">{c.label}</span>
                                        </label>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 shrink-0 gap-1"
                                          onClick={() =>
                                            toast.info(
                                              "Upload this document from the deal Documents tab.",
                                            )
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
                                      <span className="text-sm font-medium">
                                        Consent to process personal information
                                      </span>
                                      <Switch
                                        checked={popiaFor(party)}
                                        onCheckedChange={async (v) => {
                                          const enabled = !!v;
                                          setPopiaState((prev) => ({
                                            ...prev,
                                            [party.id]: enabled,
                                          }));
                                          const { error } = await supabase
                                            .from("party")
                                            .update({
                                              popia_consent_at: enabled
                                                ? new Date().toISOString()
                                                : null,
                                            })
                                            .eq("id", party.id);
                                          if (error) {
                                            setPopiaState((prev) => ({
                                              ...prev,
                                              [party.id]: !enabled,
                                            }));
                                            toast.error(error.message);
                                            return;
                                          }
                                          toast.success(
                                            enabled
                                              ? "POPIA consent recorded"
                                              : "POPIA consent withdrawn",
                                            { description: party.name },
                                          );
                                          void queryClient.invalidateQueries({
                                            queryKey: ["fica-register"],
                                          });
                                        }}
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Purpose: processing of identity verification, FICA compliance,
                                      and transaction documentation for the sale of immovable
                                      property in accordance with POPIA section 11.
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
