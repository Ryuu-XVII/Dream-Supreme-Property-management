import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth, type UserAccount } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { type Role } from "@/types";
import { useAdminUsers, type AdminUser } from "@/data/users";

const ROLES: Role[] = ["Principal", "Admin", "Agent", "Candidate"];
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, UserPlus, Pencil, Trash2, Percent, Loader2, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const { data: usersList = [], isLoading, refetch } = useAdminUsers();
  const navigate = useNavigate();
  const { startImpersonating } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "All">("All");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<Partial<AdminUser>>({
    name: "",
    email: "",
    role: "Agent",
    active: true,
    commissionPct: 50,
  });

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "All" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const paginatedUsers = filteredUsers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedUsers.map((u) => u.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const bulkRetire = () => {
    if (confirm(`Are you sure you want to retire ${selectedIds.length} agents?`)) {
      // In real app, perform bulk Supabase update
      setSelectedIds([]);
      // toast.success(`${selectedIds.length} agents retired`);
    }
  };

  const bulkResetCommission = () => {
    if (confirm(`Are you sure you want to reset commission for ${selectedIds.length} agents?`)) {
      // In real app, perform bulk Supabase update
      setSelectedIds([]);
      // toast.success(`Commission reset for ${selectedIds.length} agents`);
    }
  };

  const roleTone = (r: Role) => {
    switch (r) {
      case "Principal":
        return "border-purple-500/30 text-purple-600 bg-purple-500/10";
      case "Admin":
        return "border-slate-500/30 text-slate-600 bg-slate-500/10";
      case "Agent":
        return "border-indigo-500/30 text-indigo-600 bg-indigo-500/10";
      case "Candidate":
        return "border-sky-500/30 text-sky-600 bg-sky-500/10";
      default:
        return "";
    }
  };

  const startEdit = (u: AdminUser) => {
    setEditing(u);
    setDraft(u);
    setDialogOpen(true);
  };

  const startNew = () => {
    setEditing(null);
    setDraft({ name: "", email: "", role: "Agent", active: true, commissionPct: 50 });
    setDialogOpen(true);
  };

  const save = () => {
    // In a real app, this would mutate via Supabase/React Query
    setDialogOpen(false);
    refetch(); // placeholder for actual mutation logic
  };

  const retireUser = (id: string) => {
    if (
      confirm("Are you sure you want to retire this agent? They will lose access to the system.")
    ) {
      // Logic to deactivate user via Supabase
      refetch(); // Placeholder
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Team & Users"
        description="Manage system access, agent profiles, and commission structures."
      />

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/50">
          <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border/50"
              />
            </div>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm font-medium text-muted-foreground mr-2">
                  {selectedIds.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={bulkResetCommission}
                  className="text-xs h-8"
                >
                  Reset Commission
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={bulkRetire}
                  className="text-xs h-8"
                >
                  Retire Selected
                </Button>
              </div>
            )}
            <Select value={roleFilter} onValueChange={(v: Role | "All") => setRoleFilter(v)}>
              <SelectTrigger className="w-35 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Roles</SelectItem>
                {ROLES.map((r: Role) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={startNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
          >
            <UserPlus className="size-4 mr-2" /> Invite Member
          </Button>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No team members found"
              message="Try adjusting your filters or invite a new member."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedIds.length > 0 && selectedIds.length === paginatedUsers.length
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Split</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(u.id)}
                        onCheckedChange={() => toggleSelect(u.id)}
                        aria-label={`Select ${u.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="size-8 rounded-full flex items-center justify-center text-white font-medium text-xs"
                          style={{ backgroundColor: u.colour }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleTone(u.role)}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.active ? "default" : "secondary"}
                        className={
                          u.active
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0"
                            : ""
                        }
                      >
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.role === "Agent" || u.role === "Candidate" ? (
                        <div className="text-sm">
                          <div>
                            <span className="font-medium">{u.activeDeals || 0}</span> active deals
                          </div>
                          <div className="text-xs text-muted-foreground">
                            R {(u.ytdRevenue || 0).toLocaleString()} YTD
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.commissionPct !== undefined ? (
                        <span className="font-mono text-sm">{u.commissionPct}%</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(u.role === "Agent" || u.role === "Candidate") && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                startImpersonating({
                                  id: u.id,
                                  agencyId: "current", // Assuming this is fine for frontend impersonation
                                  branchId: null,
                                  fullName: u.name,
                                  email: u.email,
                                  role: u.role.toLowerCase() as "agent" | "candidate",
                                  status: u.active ? "active" : "suspended",
                                });
                                navigate({ to: "/" });
                              }}
                              className="text-xs mr-2"
                            >
                              <Eye className="size-3 mr-1" />
                              View Portal
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(u)}
                              className="text-xs mr-2"
                            >
                              <Percent className="size-3 mr-1" />
                              Adjust Split
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(u)}
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => retireUser(u.id)}
                          className="h-8 w-8 text-slate-500 hover:text-amber-600"
                          title="Retire Agent"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(page * itemsPerPage, filteredUsers.length)} of {filteredUsers.length}{" "}
                  agents
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Team Member" : "Invite New Team Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editing && (
              <div className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 p-3 rounded-lg text-sm mb-2 border border-indigo-100 dark:border-indigo-900/50">
                New team members register through an invitation from the principal or administrator.
                An invitation email will be sent containing instructions to set their password.
              </div>
            )}
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={draft.role}
                  onValueChange={(v: Role) => setDraft((d) => ({ ...d, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r: Role) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center h-10 px-3 border rounded-md border-input">
                  <Switch
                    checked={draft.active}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
                  />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {draft.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {(draft.role === "Agent" || draft.role === "Candidate") && (
              <div className="space-y-2">
                <Label>Commission Split (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.commissionPct}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, commissionPct: Number(e.target.value) }))
                  }
                  placeholder="70"
                />
                <p className="text-xs text-muted-foreground">
                  Percentage of commission the agent receives.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {editing ? "Save Changes" : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
