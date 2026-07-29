import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";
import { GlassCard, KpiCard, TableSkeleton, useFakeLoad } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dateFmt, daysUntil } from "@/lib/format";
import { users, agency } from "@/data/state";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  Eye,
  UploadCloud,
  Award,
} from "lucide-react";

export const Route = createFileRoute("/compliance/ffc")({
  component: FfcRegister,
  head: () => ({
    meta: [
      { title: "FFC Register | Dream Supreme Properties" },
      {
        name: "description",
        content: "Fidelity Fund Certificate register and expiry tracking for all practitioners.",
      },
      { property: "og:title", content: "FFC Register | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Fidelity Fund Certificate register and expiry tracking for all practitioners.",
      },
    ],
  }),
});

type FfcStatus = "Valid" | "Expiring Soon" | "Expired" | "Missing";

function statusOf(expiry: string | null | undefined): { status: FfcStatus; days: number | null } {
  if (!expiry) return { status: "Missing", days: null };
  const days = daysUntil(expiry);
  if (days < 0) return { status: "Expired", days };
  if (days <= 30) return { status: "Expiring Soon", days };
  return { status: "Valid", days };
}

function StatusBadge({ status }: { status: FfcStatus }) {
  const map: Record<FfcStatus, { cls: string; icon: React.ComponentType<{ className?: string }> }> =
    {
      Valid: { cls: "border-success/30 bg-success/10 text-success", icon: ShieldCheck },
      "Expiring Soon": { cls: "border-warning/40 bg-warning/15 text-warning", icon: ShieldAlert },
      Expired: { cls: "border-destructive/30 bg-destructive/10 text-destructive", icon: ShieldX },
      Missing: { cls: "border-border bg-muted text-muted-foreground", icon: ShieldQuestion },
    };
  const { cls, icon: Icon } = map[status];
  return (
    <Badge variant="outline" className={cn("gap-1", cls)}>
      <Icon className="size-3" /> {status}
    </Badge>
  );
}

function CertificateDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: (typeof users)[number];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fidelity Fund Certificate</DialogTitle>
          <DialogDescription>
            Issued by the Property Practitioners Regulatory Authority (PPRA)
          </DialogDescription>
        </DialogHeader>
        <div className="glass rounded-xl border-2 border-dashed border-primary/30 p-6 text-center">
          <Award className="mx-auto size-10 text-primary" />
          <p className="mt-3 font-display text-lg font-semibold">{agency.name}</p>
          <p className="text-xs text-muted-foreground">{agency.address}</p>
          <div className="my-4 border-t border-border" />
          <p className="text-sm text-muted-foreground">This certifies that</p>
          <p className="mt-1 font-display text-xl font-bold">{user.name}</p>
          <p className="text-xs text-muted-foreground">PPRA Registration {user.ppra}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-left text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Certificate No.</p>
              <p className="money font-semibold">{user.ffc?.number ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Issued</p>
              <p className="font-semibold">{user.ffc ? dateFmt(user.ffc.issued) : "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Expiry</p>
              <p className="font-semibold">{user.ffc?.expiry ? dateFmt(user.ffc.expiry) : "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Status</p>
              <StatusBadge status={statusOf(user.ffc?.expiry).status} />
            </div>
          </div>
          <p className="mt-6 text-[10px] text-muted-foreground">
            This document is a mock representation for demonstration purposes only.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: (typeof users)[number];
}) {
  const [number, setNumber] = useState(user.ffc?.number ?? "");
  const [issued, setIssued] = useState(user.ffc?.issued ?? "");
  const [expiry, setExpiry] = useState(user.ffc?.expiry ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload FFC certificate</DialogTitle>
          <DialogDescription>
            Update {user.name}'s Fidelity Fund Certificate record.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ffc-number">Certificate number</Label>
            <Input
              id="ffc-number"
              className="font-mono"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ffc-issued">Issued date</Label>
              <Input
                id="ffc-issued"
                type="date"
                value={issued}
                onChange={(e) => setIssued(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ffc-expiry">Expiry date</Label>
              <Input
                id="ffc-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ffc-file">Certificate file</Label>
            <Input id="ffc-file" type="file" accept=".pdf,.jpg,.png" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Certificate uploaded", {
                description: `${user.name} · ${number || "no number"}`,
              });
            }}
          >
            Save certificate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FfcRegister() {
  const loading = useFakeLoad(400);
  const [viewUser, setViewUser] = useState<(typeof users)[number] | null>(null);
  const [uploadUser, setUploadUser] = useState<(typeof users)[number] | null>(null);

  const rows = useMemo(
    () =>
      users.map((u) => {
        const { status, days } = statusOf(u.ffc?.expiry);
        return { user: u, status, days };
      }),
    [],
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      valid: rows.filter((r) => r.status === "Valid").length,
      expiring: rows.filter((r) => r.status === "Expiring Soon").length,
      expired: rows.filter((r) => r.status === "Expired" || r.status === "Missing").length,
    }),
    [rows],
  );

  return (
    <AppShell
      title="FFC Register"
      description="Fidelity Fund Certificate tracking for every practitioner in the agency."
      crumbs={[{ label: "Compliance" }, { label: "FFC Register" }]}
    >
      <ComplianceTabs />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total practitioners" value={counts.total} icon={ShieldQuestion} />
        <KpiCard
          label="Valid"
          value={counts.valid}
          tone="success"
          icon={ShieldCheck}
          delay={0.05}
        />
        <KpiCard
          label="Expiring soon"
          value={counts.expiring}
          tone="warning"
          icon={ShieldAlert}
          delay={0.1}
        />
        <KpiCard
          label="Expired / missing"
          value={counts.expired}
          tone="danger"
          icon={ShieldX}
          delay={0.15}
        />
      </div>

      <GlassCard className="mt-6 p-0">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={6} cols={7} />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Certificate No.</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Days until expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ user, status, days }) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.seniority}</TableCell>
                    <TableCell className="money">{user.ffc?.number ?? "—"}</TableCell>
                    <TableCell>{user.ffc ? dateFmt(user.ffc.issued) : "—"}</TableCell>
                    <TableCell>{user.ffc?.expiry ? dateFmt(user.ffc.expiry) : "—"}</TableCell>
                    <TableCell
                      className={cn(
                        "money",
                        days != null && days < 0 && "text-destructive",
                        days != null && days >= 0 && days <= 30 && "text-warning",
                      )}
                    >
                      {days == null ? "—" : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          onClick={() => setViewUser(user)}
                        >
                          <Eye className="size-3.5" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          onClick={() => setUploadUser(user)}
                        >
                          <UploadCloud className="size-3.5" /> Upload
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

      {viewUser && (
        <CertificateDialog
          open={!!viewUser}
          onOpenChange={(v) => !v && setViewUser(null)}
          user={viewUser}
        />
      )}
      {uploadUser && (
        <UploadDialog
          open={!!uploadUser}
          onOpenChange={(v) => !v && setUploadUser(null)}
          user={uploadUser}
        />
      )}
    </AppShell>
  );
}
