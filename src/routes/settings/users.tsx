import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { AgentAvatar, FicaBadge } from "@/components/badges";
import { users as initialUsers, branches, type Role, type User } from "@/data/mock";
import { useCan } from "@/lib/app-state";
import { dateFmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Archive, ShieldAlert, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/settings/users")({
  head: () => ({
    meta: [
      { title: "User Management | Dream Supreme Properties" },
      { name: "description", content: "Manage agency users, roles, branches, FFC status and access." },
      { property: "og:title", content: "User Management | Dream Supreme Properties" },
      { property: "og:description", content: "Manage agency users, roles, branches, FFC status and access." },
    ],
  }),
  component: UsersPage,
});

const ROLES: Role[] = ["Principal", "Agent", "Candidate", "Admin"];

interface Draft {
  name: string;
  email: string;
  mobile: string;
  role: Role;
  branch: string;
  ppra: string;
  candidate: boolean;
  supervisor: string;
}

function emptyDraft(): Draft {
  return { name: "", email: "", mobile: "", role: "Agent", branch: branches[0].name, ppra: "", candidate: false, supervisor: "" };
}

function roleTone(role: Role) {
  switch (role) {
    case "Principal": return "border-primary/30 bg-primary/10 text-primary";
    case "Admin": return "border-info/30 bg-info/10 text-info";
    case "Agent": return "border-success/30 bg-success/10 text-success";
    case "Candidate": return "border-warning/40 bg-warning/15 text-warning";
  }
}

function ffcStatus(u: User): { label: string; tone: string } {
  if (!u.ffc) return { label: "N/A", tone: "bg-muted text-muted-foreground" };
  const days = Math.round((new Date(u.ffc.expiry ?? "").getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Expired", tone: "border-destructive/30 bg-destructive/10 text-destructive" };
  if (days <= 30) return { label: `Expires ${dateFmt(u.ffc.expiry!)}`, tone: "border-warning/40 bg-warning/15 text-warning" };
  return { label: `Valid to ${dateFmt(u.ffc.expiry!)}`, tone: "border-success/30 bg-success/10 text-success" };
}

function UsersPage() {
  const canManage = useCan("users.manage");
  const [userList, setUserList] = useState<User[]>(initialUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [archiveTarget, setArchiveTarget] = useState<User | null>(null);

  function startAdd() {
    setEditing(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  }
  function startEdit(u: User) {
    setEditing(u);
    setDraft({
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      role: u.role,
      branch: u.branch,
      ppra: u.ppra,
      candidate: u.role === "Candidate",
      supervisor: u.supervisor ?? "",
    });
    setDialogOpen(true);
  }

  function save() {
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.error("Full name and email are required.");
      return;
    }
    const role: Role = draft.candidate ? "Candidate" : draft.role;
    if (editing) {
      setUserList((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? {
                ...u,
                name: draft.name,
                email: draft.email,
                mobile: draft.mobile,
                role,
                branch: draft.branch,
                ppra: draft.ppra,
                supervisor: draft.candidate ? draft.supervisor : undefined,
              }
            : u,
        ),
      );
      toast.success("User updated", { description: draft.name });
    } else {
      const newUser: User = {
        id: `u${Date.now()}`,
        name: draft.name,
        email: draft.email,
        mobile: draft.mobile,
        role,
        seniority: role === "Candidate" ? "Candidate" : "Mid-level",
        branch: draft.branch,
        ppra: draft.ppra || "—",
        ffc: null,
        supervisor: draft.candidate ? draft.supervisor : undefined,
        active: true,
        colour: "#5a6b8f",
      };
      setUserList((prev) => [...prev, newUser]);
      toast.success("User added", { description: draft.name });
    }
    setDialogOpen(false);
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    setUserList((prev) => prev.map((u) => (u.id === archiveTarget.id ? { ...u, active: !u.active } : u)));
    toast.success(archiveTarget.active ? "User archived" : "User restored", { description: archiveTarget.name });
    setArchiveTarget(null);
  }

  const potentialSupervisors = userList.filter((u) => u.role === "Agent" || u.role === "Principal");

  return (
    <AppShell title="Settings" description="Manage users, roles, branch assignments and FFC compliance.">
      <SettingsTabs />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <GlassCard>
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <UsersIcon className="size-4 shrink-0 text-primary" />
              <h2 className="truncate font-display text-lg font-semibold">Agency Users</h2>
            </div>
            {canManage ? (
              <Button size="sm" onClick={startAdd} className="shrink-0">
                <Plus className="mr-1 size-4" /> Add User
              </Button>
            ) : (
              <Badge variant="outline" className="shrink-0 gap-1 border-warning/40 bg-warning/15 text-warning">
                <ShieldAlert className="size-3.5" /> Read-only
              </Badge>
            )}
          </div>

          {userList.length === 0 ? (
            <EmptyState title="No users" message="Add your first team member to get started." />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>FFC Status</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userList.map((u) => {
                    const ffc = ffcStatus(u);
                    return (
                      <TableRow key={u.id} className={!u.active ? "opacity-50" : ""}>
                        <TableCell>
                          <AgentAvatar user={u} showName />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleTone(u.role)}>{u.role}</Badge>
                        </TableCell>
                        <TableCell>{u.branch}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ffc.tone}>{ffc.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={u.active ? "border-success/30 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                            {u.active ? "Active" : "Archived"}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(u)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setArchiveTarget(u)}>
                              <Archive className="size-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input value={draft.mobile} onChange={(e) => setDraft((d) => ({ ...d, mobile: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select
                  value={draft.candidate ? "Candidate" : draft.role}
                  onValueChange={(v) => setDraft((d) => ({ ...d, role: v as Role, candidate: v === "Candidate" }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={draft.branch} onValueChange={(v) => setDraft((d) => ({ ...d, branch: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>PPRA Reference</Label>
              <Input value={draft.ppra} onChange={(e) => setDraft((d) => ({ ...d, ppra: e.target.value }))} className="mt-1 money" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label className="mb-0">Candidate Practitioner</Label>
              <Switch
                checked={draft.candidate}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, candidate: v, role: v ? "Candidate" : "Agent" }))}
              />
            </div>
            {draft.candidate && (
              <div>
                <Label>Supervisor</Label>
                <Select value={draft.supervisor} onValueChange={(v) => setDraft((d) => ({ ...d, supervisor: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                  <SelectContent>
                    {potentialSupervisors.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archiveTarget?.active ? "Archive User" : "Restore User"}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.active
                ? `${archiveTarget?.name} will be archived and lose portal access. This does not delete their historical records.`
                : `${archiveTarget?.name} will be restored and regain portal access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
