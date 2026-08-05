import { render } from "@react-email/render";
import { InvitationEmailTemplate } from "@/emails/invitation";
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

const ROLES: Role[] = ["Agent", "Admin"];
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
import {
  Search,
  Plus,
  UserPlus,
  Pencil,
  Trash2,
  Percent,
  Loader2,
  Eye,
  Download,
  CheckCircle2,
} from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const { data: usersList = [], isLoading, refetch } = useAdminUsers();
  const navigate = useNavigate();
  const { account, startImpersonating } = useAuth();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "All">("All");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
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

  const exportAgentTimeline = async (userId: string, userName: string) => {
    try {
      // Fetch deal timeline
      const { data: deals, error: dErr } = await supabase
        .from("deal_timeline")
        .select(
          `
          occurred_at,
          stage,
          deal!inner(
            title,
            deal_participant!inner(user_account_id)
          )
        `,
        )
        .eq("deal.deal_participant.user_account_id", userId)
        .order("occurred_at", { ascending: false });

      if (dErr) throw dErr;

      // Map to CSV structure
      const exportData = (deals || []).map((d: any) => ({
        Agent: userName,
        Date: new Date(d.occurred_at).toLocaleString(),
        Type: "Deal Stage Update",
        Property: d.deal.title,
        Detail: `Moved to ${d.stage}`,
      }));

      if (exportData.length === 0) {
        toast.info("No timeline data found for this agent.");
        return;
      }

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `timeline_${userName.replace(/ /g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Timeline data exported successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to export timeline data.");
    }
  };

  const bulkExportTimeline = async () => {
    if (selectedIds.length === 0) return;
    try {
      const { data: deals, error: dErr } = await supabase
        .from("deal_timeline")
        .select(
          `
          occurred_at,
          stage,
          deal!inner(
            title,
            deal_participant!inner(
              user_account_id,
              user_account!inner(
                user_metadata
              )
            )
          )
        `,
        )
        .in("deal.deal_participant.user_account_id", selectedIds)
        .order("occurred_at", { ascending: false });

      if (dErr) throw dErr;

      const exportData = (deals || []).map((d: any) => {
        // Find the matching participant to get their name
        const participant = d.deal.deal_participant.find((p: any) =>
          selectedIds.includes(p.user_account_id),
        );
        const agentName = participant
          ? `${participant.user_account.user_metadata?.first_name || ""} ${participant.user_account.user_metadata?.last_name || ""}`.trim()
          : "Unknown";

        return {
          Agent: agentName,
          Date: new Date(d.occurred_at).toLocaleString(),
          Type: "Deal Stage Update",
          Property: d.deal.title,
          Detail: `Moved to ${d.stage}`,
        };
      });

      if (exportData.length === 0) {
        toast.info("No timeline data found for selected agents.");
        return;
      }

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bulk_timeline_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported data for ${selectedIds.length} agents.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to bulk export timeline data.");
    }
  };

  const roleTone = (r: Role) => {
    switch (r) {
      case "Admin":
        return "border-slate-500/30 text-slate-600 bg-slate-500/10";
      case "Agent":
        return "border-indigo-500/30 text-indigo-600 bg-indigo-500/10";
      default:
        return "";
    }
  };

  const startEdit = (u: AdminUser) => {
    setEditing(u);
    setDraft(u);
    setGeneratedLink(null);
    setDialogOpen(true);
  };

  const startNew = () => {
    setEditing(null);
    setDraft({ name: "", email: "", role: "Agent", active: true, commissionPct: 50 });
    setGeneratedLink(null);
    setDialogOpen(true);
  };

  const save = async () => {
    const name = draft.name?.trim() ?? "";
    const email = draft.email?.trim() ?? "";
    const role = (draft.role ?? "Agent") as Role;

    if (!name || !email) {
      toast.error("Full name and email address are required.");
      return;
    }

    try {
      if (editing) {
        // Update existing user_account record
        const { error } = await supabase
          .from("user_account")
          .update({
            full_name: name,
            email: email,
            role: role.toLowerCase() as "agent" | "admin",
            status: draft.active ? "active" : "suspended",
          })
          .eq("id", editing.id);

        if (error) throw error;
        toast.success("User updated successfully", { description: name });
      } else {
        // Step 1: Clean up any prior unaccepted invitations for this email
        await supabase
          .from("user_invitation")
          .delete()
          .eq("email", email.toLowerCase())
          .is("accepted_at", null);

        // Step 2: Generate new invitation token via RPC
        const { data: inviteToken, error: rpcErr } = await supabase.rpc("create_user_invitation", {
          p_email: email,
          p_role: role.toLowerCase() as "agent" | "admin",
        });

        if (rpcErr) throw rpcErr;

        // Step 3: Construct direct registration link for registration page
        const directRegisterUrl = `${window.location.origin}/register?token=${inviteToken}&email=${encodeURIComponent(email)}`;
        setGeneratedLink(directRegisterUrl);

        // Step 4: Dispatch official invitation email via Supabase Auth admin API
        const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
          email.toLowerCase(),
          {
            redirectTo: directRegisterUrl,
            data: { full_name: name, role: role, invite_token: inviteToken },
          },
        );

        // Step 5: Render React Email template for local database audit history
        const emailBodyHtml = await render(
          InvitationEmailTemplate({
            name,
            role,
            inviteUrl: directRegisterUrl,
          }),
        );

        let agencyId = account?.agencyId;
        if (!agencyId) {
          const { data: agList } = await supabase.from("agency").select("id").limit(1);
          agencyId = agList?.[0]?.id;
        }

        if (agencyId) {
          await supabase.from("email_queue").insert({
            agency_id: agencyId,
            recipient_email: email.toLowerCase(),
            subject: "You've been invited to join Dream Supreme Properties",
            body_html: emailBodyHtml,
            status: inviteError ? "failed" : "sent",
          });
        }

        if (inviteError) {
          toast.error(`Email Dispatch Failed: ${inviteError.message}`, {
            description: "You can copy and send the sign-up link directly using the button below.",
          });
        } else {
          toast.success("Invitation Email Dispatched!", {
            description: `Supabase default email dispatched to ${email}.`,
          });
        }

        refetch();
        return; // Keep dialog open so admin can copy the link
      }

      setDialogOpen(false);
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Action failed: " + (err.message || "Could not save user"));
    }
  };

  const retireUser = async (id: string) => {
    if (
      confirm("Are you sure you want to retire this agent? They will lose access to the system.")
    ) {
      try {
        const { error } = await supabase
          .from("user_account")
          .update({ status: "suspended" })
          .eq("id", id);
        if (error) throw error;
        toast.success("Agent retired successfully");
        refetch();
      } catch (err: any) {
        toast.error("Failed to retire agent: " + err.message);
      }
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
                  onClick={bulkExportTimeline}
                  className="text-xs h-8"
                >
                  <Download className="size-3 mr-1" />
                  Export Data
                </Button>
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
                      {u.role === "Agent" ? (
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
                        {u.role === "Agent" && (
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
                                  role: "agent",
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
                              onClick={() => exportAgentTimeline(u.id, u.name)}
                              className="text-xs mr-2"
                            >
                              <Download className="size-3 mr-1" />
                              Export
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
                New team members register via an invitation token link. Generating an invitation
                creates a direct sign-up link for the agent to set their password.
              </div>
            )}
            {!editing && generatedLink && (
              <div className="rounded-lg border border-success/40 bg-success/10 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-success flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Agent Sign-Up Link Created
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="text-xs bg-background/80 font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 gap-1 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      toast.success("Sign-up link copied to clipboard!");
                    }}
                  >
                    Copy Link
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Send this registration link directly to the agent. They will set their own
                  password upon opening it.
                </p>
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

            {draft.role === "Agent" && (
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
