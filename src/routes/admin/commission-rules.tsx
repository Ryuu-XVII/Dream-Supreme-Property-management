import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Archive, Pencil, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard, EmptyState, TableSkeleton } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RuleSet, DeductionLine } from "@/types";
import {
  DEFAULT_VAT_PERCENT,
  DEFAULT_SALE_PRICE_CENTS,
  DEFAULT_COMMISSION_BPS,
  DEFAULT_OFFICE_SHARE_PERCENT,
} from "@/lib/financial-config";
import { dateFmt, zar } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/commission-rules")({
  head: () => ({
    meta: [
      { title: "Commission Rules | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Configure commission rule sets, VAT treatment, deduction lines and office share for Dream Supreme Properties.",
      },
      { property: "og:title", content: "Commission Rules | Dream Supreme Properties" },
      {
        property: "og:description",
        content:
          "Configure commission rule sets, VAT treatment, deduction lines and office share for Dream Supreme Properties.",
      },
    ],
  }),
  component: CommissionRulesPage,
});

const DEDUCTION_TYPES: DeductionLine["type"][] = [
  "Franchise Fee",
  "Referral Fee",
  "Marketing Recovery",
  "Co-mandate Share",
  "Desk Fee",
];

let lineSeq = 1000;
function newLine(): DeductionLine {
  lineSeq += 1;
  return {
    id: `newline-${lineSeq}`,
    type: "Franchise Fee",
    basis: "Percentage of Remaining",
    bps: 500,
    payee: "",
  };
}

function blankRuleSet(): RuleSet {
  return {
    id: `rs-new-${Date.now()}`,
    name: "New Rule Set",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: undefined,
    isDefault: false,
    vatInclusive: true,
    defaultBps: DEFAULT_COMMISSION_BPS,
    rounding: "Nearest cent",
    officeSharePct: DEFAULT_OFFICE_SHARE_PERCENT,
    deductions: [],
  };
}

function computePreview(rs: RuleSet, sampleSale: number) {
  const gross = Math.round((sampleSale * rs.defaultBps) / 10000);
  const vat = rs.vatInclusive
    ? Math.round(gross - gross / (1 + DEFAULT_VAT_PERCENT / 100))
    : Math.round(gross * (DEFAULT_VAT_PERCENT / 100));
  const net = rs.vatInclusive ? gross - vat : gross;

  const steps: {
    label: string;
    formula: string;
    amount: number;
    kind: "base" | "deduct" | "subtotal" | "final";
  }[] = [
    {
      label: "Gross commission",
      formula: `${zar(sampleSale)} × ${(rs.defaultBps / 100).toFixed(2)}%`,
      amount: gross,
      kind: "base",
    },
    {
      label: rs.vatInclusive
        ? `Less VAT (${DEFAULT_VAT_PERCENT}%, incl.)`
        : `Plus VAT (${DEFAULT_VAT_PERCENT}%, excl.)`,
      formula: rs.vatInclusive
        ? `gross − gross ÷ (1 + ${DEFAULT_VAT_PERCENT}/100)`
        : `gross × ${DEFAULT_VAT_PERCENT}%`,
      amount: rs.vatInclusive ? -vat : vat,
      kind: "deduct",
    },
    {
      label: "Net commission",
      formula: rs.vatInclusive ? "gross − VAT" : "gross (VAT added separately)",
      amount: net,
      kind: "subtotal",
    },
  ];

  let running = net;
  for (const line of rs.deductions) {
    let amt = 0;
    let formula = "";
    if (line.basis === "Percentage") {
      amt = Math.round((net * (line.bps ?? 0)) / 10000);
      formula = `net × ${((line.bps ?? 0) / 100).toFixed(2)}%`;
    } else if (line.basis === "Percentage of Remaining") {
      amt = Math.round((running * (line.bps ?? 0)) / 10000);
      formula = `remaining pool × ${((line.bps ?? 0) / 100).toFixed(2)}%`;
    } else {
      amt = line.fixed ?? 0;
      formula = "fixed amount";
    }
    running -= amt;
    steps.push({
      label: `Less ${line.type}${line.payee ? ` → ${line.payee}` : ""}`,
      formula,
      amount: -amt,
      kind: "deduct",
    });
  }
  steps.push({
    label: "Distributable pool",
    formula: "net − deductions",
    amount: running,
    kind: "subtotal",
  });

  const office = Math.round((running * rs.officeSharePct) / 100);
  const agentPool = running - office;
  steps.push({
    label: `Office share (${rs.officeSharePct}%)`,
    formula: `pool × ${rs.officeSharePct}%`,
    amount: -office,
    kind: "deduct",
  });
  steps.push({
    label: "Agent pool (net payable)",
    formula: "pool − office share",
    amount: agentPool,
    kind: "final",
  });

  return steps;
}

function CommissionRulesPage() {
  const queryClient = useQueryClient();
  const ruleQuery = useQuery({
    queryKey: ["commission-rule-sets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rule_set")
        .select("*, deductions:commission_rule_line(*)")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      const typeNames: Record<string, DeductionLine["type"]> = {
        franchise_fee: "Franchise Fee",
        referral_fee: "Referral Fee",
        marketing_recovery: "Marketing Recovery",
        comandate_share: "Co-mandate Share",
        desk_fee: "Desk Fee",
        office_share: "Desk Fee",
      };
      return (data || []).map((row: any): RuleSet => ({
        id: row.id,
        name: row.name,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to || undefined,
        isDefault: row.is_default,
        vatInclusive: row.vat_treatment === "inclusive",
        defaultBps: row.default_commission_rate_bps,
        rounding:
          row.rounding_mode === "half_up"
            ? "Nearest cent"
            : row.rounding_mode === "bankers"
              ? "Nearest rand"
              : "Round down",
        officeSharePct: row.office_share_bps / 100,
        deductions: (row.deductions || [])
          .sort((a: any, b: any) => a.sequence - b.sequence)
          .map((line: any) => ({
            id: line.id,
            type: typeNames[line.line_type] || "Desk Fee",
            basis:
              line.calculation_basis === "fixed"
                ? "Fixed"
                : line.calculation_basis === "percentage_of_remaining"
                  ? "Percentage of Remaining"
                  : "Percentage",
            bps: line.rate_bps,
            fixed: line.fixed_amount_cents,
            payee: line.payee_type || "",
          })),
      }));
    },
  });
  const loading = ruleQuery.isLoading;
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RuleSet | null>(null);
  const [sampleSale, setSampleSale] = useState(DEFAULT_SALE_PRICE_CENTS);

  useEffect(() => {
    if (ruleQuery.data) setRuleSets(ruleQuery.data);
  }, [ruleQuery.data]);

  const openEdit = (rs: RuleSet) => {
    setEditing({ ...rs, deductions: rs.deductions.map((d) => ({ ...d })) });
    setEditorOpen(true);
  };

  const openNew = () => {
    setEditing(blankRuleSet());
    setEditorOpen(true);
  };

  const saveEditing = async () => {
    if (!editing) return;
    const lineTypes: Record<DeductionLine["type"], string> = {
      "Franchise Fee": "franchise_fee",
      "Referral Fee": "referral_fee",
      "Marketing Recovery": "marketing_recovery",
      "Co-mandate Share": "comandate_share",
      "Desk Fee": "desk_fee",
    };
    const roundingMode =
      editing.rounding === "Nearest cent"
        ? "half_up"
        : editing.rounding === "Nearest rand"
          ? "bankers"
          : "half_down";
    const { error } = await supabase.rpc("save_commission_rule_set", {
      p_payload: {
        ...editing,
        roundingMode,
        deductions: editing.deductions.map((line, index) => ({
          sequence: index,
          lineType: lineTypes[line.type],
          basis:
            line.basis === "Percentage of Remaining"
              ? "percentage_of_remaining"
              : line.basis === "Percentage"
                ? "percentage"
                : "fixed",
          rateBps: line.bps || 0,
          fixedCents: line.fixed || 0,
          payee: line.payee,
          description: line.type,
        })),
      },
    });
    if (error) return toast.error(error.message);

    await supabase.rpc("log_audit_event", {
      p_entity_type: "commission_rule_set",
      p_entity_id: editing.id,
      p_action: "Saved rule set",
      p_summary: `Saved rule set: ${editing.name}`,
      p_after_json: editing,
    });

    await queryClient.invalidateQueries({ queryKey: ["commission-rule-sets"] });
    toast.success(`Rule set "${editing.name}" saved`);
    setEditorOpen(false);
  };

  const duplicate = (rs: RuleSet) => {
    const copy: RuleSet = {
      ...rs,
      id: `${rs.id}-copy-${Date.now()}`,
      name: `${rs.name} (Copy)`,
      isDefault: false,
      deductions: rs.deductions.map((d) => ({ ...d, id: `${d.id}-c${Date.now()}` })),
    };
    setEditing(copy);
    setEditorOpen(true);
    toast.info(`Review and save the copy of "${rs.name}"`);
  };

  const archive = async (rs: RuleSet) => {
    const { error } = await supabase
      .from("commission_rule_set")
      .update({ effective_to: new Date().toISOString().slice(0, 10), is_default: false })
      .eq("id", rs.id);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["commission-rule-sets"] });
    toast.success(`Archived "${rs.name}"`);
  };

  const preview = useMemo(
    () => (editing ? computePreview(editing, sampleSale) : []),
    [editing, sampleSale],
  );

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto">
      <AdminPageHeader
        title="Commission Rules"
        description="Configure commission rule sets, deduction waterfalls and office splits."
        actions={
          <Button onClick={openNew} className="gap-2">
            <Plus className="size-4" /> New Rule Set
          </Button>
        }
      />
      <div className="space-y-6">
        <GlassCard className="mb-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Rule Sets</h2>
          {loading ? (
            <TableSkeleton rows={3} cols={5} />
          ) : ruleSets.length === 0 ? (
            <EmptyState
              title="No rule sets"
              message="Create a commission rule set to get started."
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ruleSets.map((rs) => (
                    <TableRow key={rs.id}>
                      <TableCell className="min-w-0 truncate font-medium">{rs.name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dateFmt(rs.effectiveFrom)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {rs.effectiveTo ? dateFmt(rs.effectiveTo) : "—"}
                      </TableCell>
                      <TableCell>
                        {rs.isDefault ? (
                          <Badge
                            variant="outline"
                            className="border-success/30 bg-success/10 text-success"
                          >
                            Default
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => openEdit(rs)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Duplicate"
                            onClick={() => duplicate(rs)}
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Archive"
                            onClick={() => archive(rs)}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto scrollbar-thin">
            {editing && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {ruleSets.some((r) => r.id === editing.id) ? "Edit Rule Set" : "New Rule Set"}
                  </DialogTitle>
                  <DialogDescription>
                    Configure general settings, deduction waterfall and office share. Preview
                    updates live.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
                  <div className="space-y-6 min-w-0">
                    <section className="space-y-4 rounded-lg border border-border p-4">
                      <h3 className="font-display text-sm font-semibold">General</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Name</Label>
                          <Input
                            value={editing.name}
                            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Effective From</Label>
                          <Input
                            type="date"
                            value={editing.effectiveFrom}
                            onChange={(e) =>
                              setEditing({ ...editing, effectiveFrom: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Effective To</Label>
                          <Input
                            type="date"
                            value={editing.effectiveTo ?? ""}
                            onChange={(e) =>
                              setEditing({ ...editing, effectiveTo: e.target.value || undefined })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Default Commission Rate (BPS)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editing.defaultBps}
                              onChange={(e) =>
                                setEditing({ ...editing, defaultBps: Number(e.target.value) || 0 })
                              }
                            />
                            <span className="money shrink-0 text-sm text-muted-foreground">
                              {(editing.defaultBps / 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Rounding Mode</Label>
                          <Select
                            value={editing.rounding}
                            onValueChange={(v) =>
                              setEditing({ ...editing, rounding: v as RuleSet["rounding"] })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Nearest cent">Nearest cent</SelectItem>
                              <SelectItem value="Nearest rand">Nearest rand</SelectItem>
                              <SelectItem value="Round down">Round down</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
                          <div>
                            <Label className="mb-0.5 block">VAT Treatment</Label>
                            <p className="text-xs text-muted-foreground">
                              {editing.vatInclusive
                                ? "Inclusive — commission stated already includes VAT"
                                : "Exclusive — VAT added on top of commission"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">Exclusive</span>
                            <Switch
                              checked={editing.vatInclusive}
                              onCheckedChange={(v) => setEditing({ ...editing, vatInclusive: v })}
                            />
                            <span className="text-xs text-muted-foreground">Inclusive</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
                          <Label>Default Rule Set</Label>
                          <Switch
                            checked={editing.isDefault}
                            onCheckedChange={(v) => setEditing({ ...editing, isDefault: v })}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3 rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-sm font-semibold">Deduction Lines</h3>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              deductions: [...editing.deductions, newLine()],
                            })
                          }
                        >
                          <Plus className="size-3.5" /> Add line
                        </Button>
                      </div>
                      {editing.deductions.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          No deduction lines. Add one above.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {editing.deductions.map((line, idx) => (
                            <div key={line.id} className="rounded-lg border border-border p-3">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                                <Select
                                  value={line.type}
                                  onValueChange={(v) => {
                                    const next = [...editing.deductions];
                                    next[idx] = { ...line, type: v as DeductionLine["type"] };
                                    setEditing({ ...editing, deductions: next });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DEDUCTION_TYPES.map((dt) => (
                                      <SelectItem key={dt} value={dt}>
                                        {dt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={line.basis}
                                  onValueChange={(v) => {
                                    const next = [...editing.deductions];
                                    next[idx] = { ...line, basis: v as DeductionLine["basis"] };
                                    setEditing({ ...editing, deductions: next });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Percentage">
                                      Percentage of Net Base
                                    </SelectItem>
                                    <SelectItem value="Percentage of Remaining">
                                      Percentage of Remaining (Waterfall)
                                    </SelectItem>
                                    <SelectItem value="Fixed">Fixed</SelectItem>
                                  </SelectContent>
                                </Select>
                                {line.basis === "Percentage" ? (
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      value={line.bps ?? 0}
                                      onChange={(e) => {
                                        const next = [...editing.deductions];
                                        next[idx] = { ...line, bps: Number(e.target.value) || 0 };
                                        setEditing({ ...editing, deductions: next });
                                      }}
                                    />
                                    <span className="money shrink-0 text-xs text-muted-foreground">
                                      {((line.bps ?? 0) / 100).toFixed(2)}%
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      value={(line.fixed ?? 0) / 100}
                                      onChange={(e) => {
                                        const next = [...editing.deductions];
                                        next[idx] = {
                                          ...line,
                                          fixed: Math.round(Number(e.target.value) * 100) || 0,
                                        };
                                        setEditing({ ...editing, deductions: next });
                                      }}
                                    />
                                    <span className="money shrink-0 text-xs text-muted-foreground">
                                      {zar(line.fixed ?? 0)}
                                    </span>
                                  </div>
                                )}
                                <Input
                                  placeholder="Payee"
                                  value={line.payee}
                                  onChange={(e) => {
                                    const next = [...editing.deductions];
                                    next[idx] = { ...line, payee: e.target.value };
                                    setEditing({ ...editing, deductions: next });
                                  }}
                                />
                                <div className="flex items-center gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      const next = [...editing.deductions];
                                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                      setEditing({ ...editing, deductions: next });
                                    }}
                                  >
                                    <ArrowUp className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={idx === editing.deductions.length - 1}
                                    onClick={() => {
                                      const next = [...editing.deductions];
                                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                      setEditing({ ...editing, deductions: next });
                                    }}
                                  >
                                    <ArrowDown className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    onClick={() => {
                                      setEditing({
                                        ...editing,
                                        deductions: editing.deductions.filter(
                                          (_, i2) => i2 !== idx,
                                        ),
                                      });
                                    }}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="space-y-3 rounded-lg border border-border p-4">
                      <h3 className="font-display text-sm font-semibold">Office Share</h3>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[editing.officeSharePct]}
                          max={100}
                          step={1}
                          onValueChange={([v]) => setEditing({ ...editing, officeSharePct: v })}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input
                            type="number"
                            className="w-20"
                            value={editing.officeSharePct}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                officeSharePct: Math.min(
                                  100,
                                  Math.max(0, Number(e.target.value) || 0),
                                ),
                              })
                            }
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Agent pool receives {100 - editing.officeSharePct}% of the distributable
                        pool.
                      </p>
                    </section>
                  </div>

                  <div className="min-w-0">
                    <GlassCard className="sticky top-4">
                      <h3 className="mb-1 font-display text-sm font-semibold">Live Preview</h3>
                      <div className="mb-3 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Mock Sale Price</Label>
                        <Input
                          type="number"
                          value={sampleSale / 100}
                          onChange={(e) => setSampleSale((Number(e.target.value) || 0) * 100)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        {preview.map((step, i) => (
                          <div
                            key={i}
                            className={
                              step.kind === "final"
                                ? "flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
                                : step.kind === "subtotal"
                                  ? "flex items-center justify-between gap-2 border-t border-border px-1 py-1.5"
                                  : "flex items-center justify-between gap-2 px-1 py-1"
                            }
                          >
                            <div className="min-w-0">
                              <p
                                className={
                                  step.kind === "final"
                                    ? "text-sm font-semibold"
                                    : "text-xs text-muted-foreground"
                                }
                              >
                                {step.label}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground/70">
                                {step.formula}
                              </p>
                            </div>
                            <span
                              className={
                                step.kind === "final"
                                  ? "money shrink-0 text-base font-bold text-primary"
                                  : step.amount < 0
                                    ? "money shrink-0 text-sm text-destructive"
                                    : "money shrink-0 text-sm"
                              }
                            >
                              {step.amount < 0
                                ? `− ${zar(Math.abs(step.amount))}`
                                : zar(step.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditorOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveEditing}>Save Rule Set</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
