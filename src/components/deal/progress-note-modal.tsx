import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquarePlus } from "lucide-react";

interface ProgressNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealRef: string;
  onSuccess?: (note: { id: string; at: string; action: string; reason: string }) => void;
}

const noteCategories = [
  { value: "General Progress", label: "General Progress" },
  { value: "Conveyancer Update", label: "Conveyancer & Attorney Update" },
  { value: "Client Communication", label: "Client / Party Communication" },
  { value: "Compliance Check", label: "Compliance & FICA" },
  { value: "Financial / Bond", label: "Financial / Bond Application" },
];

export function ProgressNoteModal({
  open,
  onOpenChange,
  dealId,
  dealRef,
  onSuccess,
}: ProgressNoteModalProps) {
  const [category, setCategory] = useState("General Progress");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      toast.error("Please enter a progress note.");
      return;
    }

    setSubmitting(true);
    try {
      // Record progress note in audit log and timeline via RPC/insert
      const { data: userAcc } = await supabase
        .from("user_account")
        .select("id, full_name")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();

      const actorName = userAcc?.full_name || "Agent";

      const { error } = await supabase.from("audit_log").insert({
        agency_id: (await supabase.from("deal").select("agency_id").eq("id", dealId).single()).data
          ?.agency_id,
        user_account_id: userAcc?.id,
        action: `NOTE: ${category}`,
        entity_type: "deal",
        entity_id: dealId,
        summary: `Progress note logged for deal ${dealRef} [${category}]: ${note.trim()}`,
      });

      if (error) throw error;

      toast.success("Progress note logged successfully");

      const newEntry = {
        id: `note_${Date.now()}`,
        at: new Date().toISOString(),
        action: `Note Added (${category})`,
        reason: note.trim(),
        actor: actorName,
      };

      if (onSuccess) {
        onSuccess(newEntry as any);
      }

      setNote("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Could not save progress note");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <MessageSquarePlus className="size-5 text-primary" /> Log Progress Note
          </DialogTitle>
          <DialogDescription>
            Record an operational update or notes for deal{" "}
            <span className="font-mono font-semibold text-foreground">{dealRef}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="category"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Note Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {noteCategories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="note"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Progress Details / Activity Log
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Spoke to transfer attorney; clearance certificate submitted to municipality..."
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving Note…" : "Log Progress Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
