import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui-kit";
import { UrgencyBadge } from "@/components/badges";
import type { Deal, Condition, ConditionStatus } from "@/types";
import { supabase } from "@/lib/supabase";
import { dateFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Landmark,
  Home,
  Wallet,
  Building,
  SearchCheck,
  Zap,
  CheckCircle2,
  Clock,
  Ban,
  XOctagon,
} from "lucide-react";

const typeIcons: Record<Condition["type"], React.ComponentType<{ className?: string }>> = {
  "Bond Approval": Landmark,
  "Sale of Existing Property": Home,
  "Deposit Payment": Wallet,
  "Body Corporate Consent": Building,
  "Due Diligence": SearchCheck,
  "Electrical Compliance": Zap,
};

export function DealConditionsTab({ deal }: { deal: Deal }) {
  const [conditions, setConditions] = useState<Condition[]>(deal.conditions);
  const [extendTarget, setExtendTarget] = useState<Condition | null>(null);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [bondStatus, setBondStatus] = useState(deal.bond.status);

  const setStatus = async (id: string, status: ConditionStatus) => {
    const statusMap: Record<ConditionStatus, string> = {
      Open: "pending",
      Fulfilled: "fulfilled",
      Extended: "extended",
      Waived: "waived",
      Failed: "failed",
    };
    const { error } = await supabase.rpc("set_condition_status", {
      p_condition_id: id,
      p_status: statusMap[status],
      p_new_due_on: null,
      p_reason: null,
    });
    if (error) return toast.error(error.message);
    setConditions((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    toast.success(`Condition marked as ${status}`);
  };

  const submitExtension = async () => {
    if (!extendTarget) return;
    if (!newDate || !reason.trim()) {
      toast.error("Please provide a new date and a reason for the extension.");
      return;
    }
    const { error } = await supabase.rpc("set_condition_status", {
      p_condition_id: extendTarget.id,
      p_status: "extended",
      p_new_due_on: newDate,
      p_reason: reason.trim(),
    });
    if (error) return toast.error(error.message);
    setConditions((cs) =>
      cs.map((c) =>
        c.id === extendTarget.id
          ? {
              ...c,
              status: "Extended",
              originalDueDate: c.originalDueDate ?? c.dueDate,
              dueDate: newDate,
            }
          : c,
      ),
    );
    toast.success("Condition extended");
    setExtendTarget(null);
    setNewDate("");
    setReason("");
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Suspensive conditions</h3>
        {conditions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No suspensive conditions attached to this deal.
          </p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conditions.map((c) => {
                  const Icon = typeIcons[c.type];
                  const isOpen = c.status === "Open" || c.status === "Extended";
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="flex items-center gap-2 text-xs">
                          <Icon className="size-4 text-primary" /> {c.type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm">
                        {c.description}
                      </TableCell>
                      <TableCell className="text-xs">{dateFmt(c.dueDate)}</TableCell>
                      <TableCell>
                        <UrgencyBadge dueDate={c.dueDate} status={c.status} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.responsibleParty}
                        <br />
                        <span className="text-muted-foreground">
                          {c.responsibleUserId ? "Assigned practitioner" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {isOpen ? (
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => void setStatus(c.id, "Fulfilled")}
                            >
                              <CheckCircle2 className="size-3" /> Fulfil
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => {
                                setExtendTarget(c);
                                setNewDate(c.dueDate);
                              }}
                            >
                              <Clock className="size-3" /> Extend
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-[11px]"
                              onClick={() => void setStatus(c.id, "Waived")}
                            >
                              <Ban className="size-3" /> Waive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-[11px] text-destructive"
                              onClick={() => void setStatus(c.id, "Failed")}
                            >
                              <XOctagon className="size-3" /> Fail
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No actions</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Bond application</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Status</Label>
            <Select
              value={bondStatus}
              onValueChange={async (v) => {
                const statusMap: Record<string, string> = {
                  "Not applied": "not_applied",
                  Submitted: "submitted",
                  Declined: "declined",
                  "Approved in principle": "approved_in_principle",
                  "Formally granted": "formally_granted",
                };
                const { error } = await supabase.rpc("set_bond_status", {
                  p_deal_id: deal.id,
                  p_status: statusMap[v],
                  p_institution: deal.bond.institution || null,
                });
                if (error) return toast.error(error.message);
                setBondStatus(v as Deal["bond"]["status"]);
                toast.success("Bond status updated");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "Not applied",
                  "Submitted",
                  "Declined",
                  "Approved in principle",
                  "Formally granted",
                ].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Detail label="Institution" value={deal.bond.institution} />
          <Detail
            label="Applied"
            value={deal.bond.appliedAt ? dateFmt(deal.bond.appliedAt) : "—"}
          />
          <Detail
            label="Decided"
            value={deal.bond.decidedAt ? dateFmt(deal.bond.decidedAt) : "—"}
          />
        </div>
      </GlassCard>

      <Dialog open={!!extendTarget} onOpenChange={(o) => !o && setExtendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend condition</DialogTitle>
            <DialogDescription>
              Original due date:{" "}
              {extendTarget ? dateFmt(extendTarget.originalDueDate ?? extendTarget.dueDate) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">New due date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                Reason for extension (required)
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this condition needs extending..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitExtension}>Confirm extension</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
