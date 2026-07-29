import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Copy,
  Archive,
  Pencil,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CommissionTabs } from "@/components/commission/commission-tabs";
import { GlassCard, EmptyState, TableSkeleton, useFakeLoad } from "@/components/ui-kit";
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
import {
  ruleSets as seedRuleSets,
  ruleTemplates,
  VAT_RATE,
  type RuleSet,
  type DeductionLine,
} from "@/data/state";
import { dateFmt, zar } from "@/lib/format";

export const Route = createFileRoute("/commission/")({
  head: () => ({
    meta: [
      { title: "Commission Rules | Dream Supreme Properties" },
      { name: "description", content: "Configure commission rule sets, VAT treatment, deduction lines and office share for Dream Supreme Properties." },
      { property: "og:title", content: "Commission Rules | Dream Supreme Properties" },
      { property: "og:description", content: "Configure commission rule sets, VAT treatment, deduction lines and office share for Dream Supreme Properties." },
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
  return { id: `newline-${lineSeq}`, type: "Franchise Fee", basis: "Percentage", bps: 500, payee: "" };
}

function blankRuleSet(): RuleSet {
  return {
    id: `rs-new-${Date.now()}`,
    name: "New Rule Set",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: undefined,
    isDefault: false,
    vatInclusive: true,
    defaultBps: 600,
    rounding: "Nearest cent",
    officeSharePct: 45,
    deductions: [],
  };
}

const SAMPLE_SALE = 250000000; // R2,500,000 in cents

function computePreview(rs: RuleSet) {
  const gross = Math.round((SAMPLE_SALE * rs.defaultBps) / 10000);
  const vat = rs.vatInclusive ? Math.round(gross - gross / (1 + VAT_RATE)) : Math.round(gross * VAT_RATE);
  const net = rs.vatInclusive ? gross - vat : gross;

  const steps: { label: string; formula: string; amount: number; kind: "base" | "deduct" | "subtotal" | "final" }[] = [
    { label: "Gross commission", formula: `R 2,500,000 × ${(rs.defaultBps / 100).toFixed(2)}%`, amount: gross, kind: "base" },
    {
      label: rs.vatInclusive ? "Less VAT (15%, incl.)" : "Plus VAT (15%, excl.)",
      formula: rs.vatInclusive ? "gross − gross ÷ 1.15" : "gross × 15%",
      amount: rs.vatInclusive ? -vat : vat,
      kind: "deduct",
    },
    { label: "Net commission", formula: rs.vatInclusive ? "gross − VAT" : "gross (VAT added separately)", amount: net, kind: "subtotal" },
  ];

  let running = net;
  for (const line of rs.deductions) {
    let amt = 0;
    let formula = "";
    if (line.basis === "Percentage") {
      amt = Math.round((running * (line.bps ?? 0)) / 10000);
      formula = `net × ${((line.bps ?? 0) / 100).toFixed(2)}%`;
    } else {
      amt = line.fixed ?? 0;
      formula = "fixed amount";
    }
    running -= amt;
    steps.push({ label: `Less ${line.type}${line.payee ? ` → ${line.payee}` : ""}`, formula, amount: -amt, kind: "deduct" });
  }
  steps.push({ label: "Distributable pool", formula: "net − deductions", amount: running, kind: "subtotal" });

  const office = Math.round((running * rs.officeSharePct) / 100);
  const agentPool = running - office;
  steps.push({ label: `Office share (${rs.officeSharePct}%)`, formula: `pool × ${rs.officeSharePct}%`, amount: -office, kind: "deduct" });
  steps.push({ label: "Agent pool (net payable)", formula: "pool − office share", amount: agentPool, kind: "final" });

  return steps;
}

function CommissionRulesPage() {
  const loading = useFakeLoad(500);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>(seedRuleSets);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RuleSet | null>(null);

  const openEdit = (rs: RuleSet) => {
    setEditing({ ...rs, deductions: rs.deductions.map((d) => ({ ...d })) });
    setEditorOpen(true);
  };

  const openNew = () => {
    setEditing(blankRuleSet());
    setEditorOpen(true);
  };

  const openFromTemplate = (t: (typeof ruleTemplates)[number]) => {
    const rs = blankRuleSet();
    rs.name = t.name;
    rs.defaultBps = t.bps;
    rs.officeSharePct = t.office;
    rs.deductions = t.franchise > 0 ? [{ id: newLine().id, type: "Franchise Fee", basis: "Percentage", bps: t.franchise, payee: "Franchisor" }] : [];
    setEditing(rs);
    setEditorOpen(true);
    toast.success(`Pre-filled editor from "${t.name}" template`);
  };

  const saveEditing = () => {
    if (!editing) return;
    setRuleSets((prev) => {
      const exists = prev.some((r) => r.id === editing.id);
      const next = exists ? prev.map((r) => (r.id === editing.id ? editing : r)) : [editing, ...prev];
      return editing.isDefault ? next.map((r) => (r.id === editing.id ? r : { ...r, isDefault: false })) : next;
    });
    toast.success(`Rule set "${editing.name}" saved`);
    setEditorOpen(false);
  };

  const duplicate = (rs: RuleSet) => {
    const copy: RuleSet = { ...rs, id: `${rs.id}-copy-${Date.now()}`, name: `${rs.name} (Copy)`, isDefault: false, deductions: rs.deductions.map((d) => ({ ...d, id: `${d.id}-c${Date.now()}` })) };
    setRuleSets((prev) => [copy, ...prev]);
    toast.success(`Duplicated "${rs.name}"`);
  };

  const archive = (rs: RuleSet) => {
    setRuleSets((prev) => prev.filter((r) => r.id !== rs.id));
    toast.success(`Archived "${rs.name}"`);
  };

  const preview = useMemo(() => (editing ? computePreview(editing) : []), [editing]);

  return (
    <AppShell
      title="Commission Rules"
      description="Configure commission rule sets, deduction waterfalls and office splits."
      crumbs={[{ label: "Commission" }]}
      actions={
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> New Rule Set
        </Button>
      }
    >
      <CommissionTabs />

      <GlassCard className="mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Rule Sets</h2>
        {loading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : ruleSets.length === 0 ? (
          <EmptyState title="No rule sets" message="Create a commission rule set to get started." />
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
                    <TableCell className="whitespace-nowrap">{dateFmt(rs.effectiveFrom)}</TableCell>
                    <TableCell className="whitespace-nowrap">{rs.effectiveTo ? dateFmt(rs.effectiveTo) : "—"}</TableCell>
                    <TableCell>
                      {rs.isDefault ? (
                        <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Default</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(rs)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Duplicate" onClick={() => duplicate(rs)}>
                          <Copy className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Archive" onClick={() => archive(rs)}>
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

      <GlassCard>
        <h2 className="mb-1 font-display text-lg font-semibold">Template Rule Sets</h2>
        <p className="mb-4 text-sm text-muted-foreground">Start from a well-known franchise commission model.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ruleTemplates.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button
                onClick={() => openFromTemplate(t)}
                className="lift flex h-full w-full flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-2 font-display text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" /> {t.name}
                </span>
                <p className="text-xs text-muted-foreground">{t.blurb}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                  <Badge variant="outline">{(t.bps / 100).toFixed(1)}% comm.</Badge>
                  <Badge variant="outline">{t.office}% office</Badge>
                  {t.franchise > 0 && <Badge variant="outline">{(t.franchise / 100).toFixed(1)}% franchise</Badge>}
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto scrollbar-thin">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{ruleSets.some((r) => r.id === editing.id) ? "Edit Rule Set" : "New Rule Set"}</DialogTitle>
                <DialogDescription>Configure general settings, deduction waterfall and office share. Preview updates live.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
                <div className="space-y-6 min-w-0">
                  {/* General */}
                  <section className="space-y-4 rounded-lg border border-border p-4">
                    <h3 className="font-display text-sm font-semibold">General</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Name</Label>
                        <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Effective From</Label>
                        <Input type="date" value={editing.effectiveFrom} onChange={(e) => setEditing({ ...editing, effectiveFrom: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Effective To</Label>
                        <Input type="date" value={editing.effectiveTo ?? ""} onChange={(e) => setEditing({ ...editing, effectiveTo: e.target.value || undefined })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Default Commission Rate (BPS)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editing.defaultBps}
                            onChange={(e) => setEditing({ ...editing, defaultBps: Number(e.target.value) || 0 })}
                          />
                          <span className="money shrink-0 text-sm text-muted-foreground">{(editing.defaultBps / 100).toFixed(2)}%</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Rounding Mode</Label>
                        <Select value={editing.rounding} onValueChange={(v) => setEditing({ ...editing, rounding: v as RuleSet["rounding"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                          <p className="text-xs text-muted-foreground">{editing.vatInclusive ? "Inclusive — commission stated already includes VAT" : "Exclusive — VAT added on top of commission"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">Exclusive</span>
                          <Switch checked={editing.vatInclusive} onCheckedChange={(v) => setEditing({ ...editing, vatInclusive: v })} />
                          <span className="text-xs text-muted-foreground">Inclusive</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
                        <Label>Default Rule Set</Label>
                        <Switch checked={editing.isDefault} onCheckedChange={(v) => setEditing({ ...editing, isDefault: v })} />
                      </div>
                    </div>
                  </section>

                  {/* Deduction lines */}
                  <section className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold">Deduction Lines</h3>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing({ ...editing, deductions: [...editing.deductions, newLine()] })}>
                        <Plus className="size-3.5" /> Add line
                      </Button>
                    </div>
                    {editing.deductions.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No deduction lines. Add one above.</p>
                    ) : (
                      <div className="space-y-2">
                        {editing.deductions.map((line, idx) => (
                          <div key={line.id} className="rounded-lg border border-border p-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                              <Select value={line.type} onValueChange={(v) => {
                                const next = [...editing.deductions];
                                next[idx] = { ...line, type: v as DeductionLine["type"] };
                                setEditing({ ...editing, deductions: next });
                              }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {DEDUCTION_TYPES.map((dt) => <SelectItem key={dt} value={dt}>{dt}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Select value={line.basis} onValueChange={(v) => {
                                const next = [...editing.deductions];
                                next[idx] = { ...line, basis: v as DeductionLine["basis"] };
                                setEditing({ ...editing, deductions: next });
                              }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Percentage">Percentage</SelectItem>
                                  <SelectItem value="Fixed">Fixed</SelectItem>
                                </SelectContent>
                              </Select>
                              {line.basis === "Percentage" ? (
                                <div className="flex items-center gap-1.5">
                                  <Input type="number" value={line.bps ?? 0} onChange={(e) => {
                                    const next = [...editing.deductions];
                                    next[idx] = { ...line, bps: Number(e.target.value) || 0 };
                                    setEditing({ ...editing, deductions: next });
                                  }} />
                                  <span className="money shrink-0 text-xs text-muted-foreground">{((line.bps ?? 0) / 100).toFixed(2)}%</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Input type="number" value={(line.fixed ?? 0) / 100} onChange={(e) => {
                                    const next = [...editing.deductions];
                                    next[idx] = { ...line, fixed: Math.round(Number(e.target.value) * 100) || 0 };
                                    setEditing({ ...editing, deductions: next });
                                  }} />
                                  <span className="money shrink-0 text-xs text-muted-foreground">{zar(line.fixed ?? 0)}</span>
                                </div>
                              )}
                              <Input placeholder="Payee" value={line.payee} onChange={(e) => {
                                const next = [...editing.deductions];
                                next[idx] = { ...line, payee: e.target.value };
                                setEditing({ ...editing, deductions: next });
                              }} />
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => {
                                  const next = [...editing.deductions];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  setEditing({ ...editing, deductions: next });
                                }}>
                                  <ArrowUp className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" disabled={idx === editing.deductions.length - 1} onClick={() => {
                                  const next = [...editing.deductions];
                                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                  setEditing({ ...editing, deductions: next });
                                }}>
                                  <ArrowDown className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                  setEditing({ ...editing, deductions: editing.deductions.filter((_, i2) => i2 !== idx) });
                                }}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Office share */}
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
                          onChange={(e) => setEditing({ ...editing, officeSharePct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Agent pool receives {(100 - editing.officeSharePct)}% of the distributable pool.</p>
                  </section>
                </div>

                {/* Live preview */}
                <div className="min-w-0">
                  <GlassCard className="sticky top-4">
                    <h3 className="mb-1 font-display text-sm font-semibold">Live Preview</h3>
                    <p className="mb-3 text-xs text-muted-foreground">Worked example on a R2,500,000 sale</p>
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
                            <p className={step.kind === "final" ? "text-sm font-semibold" : "text-xs text-muted-foreground"}>{step.label}</p>
                            <p className="truncate text-[10px] text-muted-foreground/70">{step.formula}</p>
                          </div>
                          <span className={step.kind === "final" ? "money shrink-0 text-base font-bold text-primary" : step.amount < 0 ? "money shrink-0 text-sm text-destructive" : "money shrink-0 text-sm"}>
                            {step.amount < 0 ? `− ${zar(Math.abs(step.amount))}` : zar(step.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
                <Button onClick={saveEditing}>Save Rule Set</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
