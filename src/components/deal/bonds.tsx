import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Trash2, Building } from "lucide-react";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useBonds, useSaveBond, useDeleteBond, type BondApplication } from "@/data/bonds";
import { zar, dateFmt } from "@/lib/format";

export function DealBondsTab({ dealId }: { dealId: string }) {
  const { data: bonds, isLoading } = useBonds(dealId);
  const saveBond = useSaveBond();
  const deleteBond = useDeleteBond();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<BondApplication>>({});

  const handleOpenNew = () => {
    setEditing({
      institution: "",
      originator: "",
      amountCents: 0,
      status: "submitted",
      appliedOn: new Date().toISOString().slice(0, 10),
    });
    setEditorOpen(true);
  };

  const handleOpenEdit = (b: BondApplication) => {
    setEditing({ ...b });
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!editing.institution) return toast.error("Institution is required.");
    if (!editing.amountCents || editing.amountCents <= 0)
      return toast.error("Valid amount is required.");

    saveBond.mutate({ ...editing, dealId } as any, {
      onSuccess: () => {
        toast.success("Bond application saved");
        setEditorOpen(false);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this bond application?")) return;
    deleteBond.mutate(
      { id, dealId },
      {
        onSuccess: () => toast.success("Deleted bond application"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Bond Applications</h2>
        <Button onClick={handleOpenNew} size="sm" className="gap-2">
          <Plus className="size-4" /> Add Application
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : bonds?.length === 0 ? (
        <EmptyState
          title="No bond applications"
          message="Record bond applications submitted by the purchaser."
          icon={Building}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bonds?.map((b) => (
            <GlassCard key={b.id} className="flex flex-col p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">{b.institution}</h3>
                  {b.originator && (
                    <p className="text-xs text-muted-foreground">Orig: {b.originator}</p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    b.status === "granted"
                      ? "bg-success/10 text-success border-success/30"
                      : b.status === "declined"
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : b.status === "aip"
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted"
                  }
                >
                  {b.status.toUpperCase()}
                </Badge>
              </div>

              <div className="text-xl font-bold font-mono tracking-tight my-2">
                {zar(b.amountCents)}
              </div>

              <div className="text-xs text-muted-foreground mt-auto">
                Applied: {dateFmt(b.appliedOn)}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(b)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(b.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing.id ? "Edit Bond Application" : "New Bond Application"}
            </DialogTitle>
            <DialogDescription>
              Track application status to a specific bank or originator.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="space-y-1.5">
              <Label>Institution / Bank</Label>
              <Input
                placeholder="e.g. Standard Bank"
                value={editing.institution || ""}
                onChange={(e) => setEditing({ ...editing, institution: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Originator (Optional)</Label>
              <Input
                placeholder="e.g. Ooba, BetterBond"
                value={editing.originator || ""}
                onChange={(e) => setEditing({ ...editing, originator: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Amount Requested</Label>
              <Input
                type="number"
                value={(editing.amountCents || 0) / 100}
                onChange={(e) =>
                  setEditing({ ...editing, amountCents: Number(e.target.value) * 100 })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={editing.status}
                onValueChange={(v: any) => setEditing({ ...editing, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="aip">Approval In Principle (AIP)</SelectItem>
                  <SelectItem value="granted">Granted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date Applied</Label>
              <Input
                type="date"
                value={editing.appliedOn || ""}
                onChange={(e) => setEditing({ ...editing, appliedOn: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveBond.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
