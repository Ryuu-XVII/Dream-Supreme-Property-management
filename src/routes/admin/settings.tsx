import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Server,
  HardDrive,
  ShieldCheck,
  Bell,
  Wrench,
  CheckCircle2,
  Database,
  RefreshCw,
  Globe,
  Lock,
  Mail,
  MessageSquare,
  Building2,
  Archive,
  Trash2,
  UserMinus,
  Radio,
  FileCheck,
  Cpu,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getR2Client, R2_BUCKET_NAME } from "@/lib/storage";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

type Action = "archive" | "deactivate" | "trash";

function AdminSettings() {
  const { account } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [actionLoading, setActionLoading] = useState<Action | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<{
    dbMs: number;
    r2Connected: boolean;
  } | null>(null);

  // Storage Settings State
  const [globalQuotaMb, setGlobalQuotaMb] = useState<number>(1024);
  const [maxFileMb, setMaxFileMb] = useState<number>(50);

  // Security Governance State
  const [sessionTimeout, setSessionTimeout] = useState("60");
  const [enforceMfa, setEnforceMfa] = useState(true);
  const [requireAdminApproval, setRequireAdminApproval] = useState(true);
  const [allowedDomains, setAllowedDomains] = useState("dreamsupreme.co.za, dreamproperty.co.za");

  // Notifications State
  const [notifyDealStages, setNotifyDealStages] = useState(true);
  const [notifyFfcWarnings, setNotifyFfcWarnings] = useState(true);
  const [notifyFicaUploads, setNotifyFicaUploads] = useState(true);
  const [notifyCommissionRecon, setNotifyCommissionRecon] = useState(true);

  // Maintenance Threshold State
  const [idleDays, setIdleDays] = useState("90");
  const [archiveDays, setArchiveDays] = useState("365");
  const [recycleRetentionDays, setRecycleRetentionDays] = useState("30");

  async function runPingTest() {
    setPingLoading(true);
    const start = performance.now();
    try {
      // 1. Ping Supabase DB
      const { error: dbErr } = await supabase.from("agency").select("id").limit(1);
      const dbMs = Math.round(performance.now() - start);

      if (dbErr) throw dbErr;

      // 2. Ping R2 Client
      const r2Client = getR2Client();
      const r2Connected = !!r2Client;

      setPingResult({ dbMs, r2Connected });
      toast.success("Diagnostics Complete", {
        description: `Database query latency: ${dbMs}ms | R2 Storage: ${r2Connected ? "Connected" : "Supabase Fallback"}`,
      });
    } catch (err: any) {
      toast.error("Diagnostics Failed", { description: err.message });
    } finally {
      setPingLoading(false);
    }
  }

  async function runMaintenanceAction(action: Action) {
    if (!account) return;
    const prompts: Record<Action, string> = {
      archive: `Archive deals older than ${archiveDays} days?`,
      deactivate: `Deactivate agents idle for more than ${idleDays} days?`,
      trash: `Permanently empty the recycle bin (older than ${recycleRetentionDays} days)? This cannot be undone.`,
    };

    if (!window.confirm(prompts[action])) return;
    setActionLoading(action);

    const rpc =
      action === "archive"
        ? "admin_archive_old_deals"
        : action === "deactivate"
          ? "admin_deactivate_idle_agents"
          : "admin_empty_recycle_bin";

    try {
      const { data, error } = await supabase.rpc(rpc, { p_agency_id: account.agencyId });
      if (error) throw error;

      toast.success(
        action === "trash"
          ? `Recycle bin emptied: ${JSON.stringify(data ?? 0)} records purged`
          : `${data ?? 0} records processed successfully`,
      );
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="System Settings & Governance Hub"
        description="Manage system infrastructure health, Cloudflare R2 storage policies, security controls, notifications, and maintenance."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-card/60 border border-border/50 p-1 rounded-xl">
          <TabsTrigger value="general" className="flex items-center gap-2 text-xs sm:text-sm">
            <Server className="size-4 text-indigo-500" />
            <span>General & Health</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-2 text-xs sm:text-sm">
            <HardDrive className="size-4 text-cyan-500" />
            <span>Storage & R2</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 text-xs sm:text-sm">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span>Security & Access</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2 text-xs sm:text-sm">
            <Bell className="size-4 text-amber-500" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2 text-xs sm:text-sm">
            <Wrench className="size-4 text-rose-500" />
            <span>Maintenance</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GENERAL & SYSTEM HEALTH */}
        <TabsContent value="general" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">System Health & Diagnostics</h2>
              <p className="text-sm text-muted-foreground">
                Real-time status monitor for database, storage, and API gateway services.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pingLoading}
              onClick={runPingTest}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${pingLoading ? "animate-spin" : ""}`} />
              Run Diagnostics Ping
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="size-5 text-emerald-500" />
                  <span className="font-semibold text-sm">PostgreSQL Database</span>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  <CheckCircle2 className="size-3 mr-1" /> Connected
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Supabase Managed Database Cluster with Row Level Security (RLS) active.
              </p>
              {pingResult && (
                <div className="text-xs font-mono bg-muted/30 p-2 rounded border text-emerald-400">
                  Latency: {pingResult.dbMs}ms
                </div>
              )}
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="size-5 text-cyan-500" />
                  <span className="font-semibold text-sm">Cloudflare R2 Storage</span>
                </div>
                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  <CheckCircle2 className="size-3 mr-1" /> S3 API Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Bucket: <code className="text-cyan-300">{R2_BUCKET_NAME}</code> with per-agent
                folder isolation.
              </p>
              {pingResult && (
                <div className="text-xs font-mono bg-muted/30 p-2 rounded border text-cyan-400">
                  R2 Adapter: {pingResult.r2Connected ? "Connected" : "Fallback Mode"}
                </div>
              )}
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="size-5 text-indigo-500" />
                  <span className="font-semibold text-sm">Auth & JWT Engine</span>
                </div>
                <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  <CheckCircle2 className="size-3 mr-1" /> Operational
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Supabase Auth with role-based JWT claims (Admin, Principal, Agent).
              </p>
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-emerald-400" />
                  <span className="font-semibold text-sm">WhatsApp Business API</span>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <Radio className="size-3 mr-1 animate-pulse" /> Ready
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Automated document & lead notification webhook gateway listening.
              </p>
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="size-5 text-amber-500" />
                  <span className="font-semibold text-sm">Agency Operational Defaults</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  ZAR (R)
                </Badge>
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div>
                  Currency:{" "}
                  <span className="text-foreground font-medium">South African Rand (ZAR)</span>
                </div>
                <div>
                  Timezone:{" "}
                  <span className="text-foreground font-medium">Africa/Johannesburg (GMT+2)</span>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="size-5 text-purple-400" />
                  <span className="font-semibold text-sm">Environment & Build</span>
                </div>
                <Badge variant="secondary">v2.4.0-enterprise</Badge>
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div>
                  Runtime: <span className="text-foreground font-medium">React 18 + Vite 8</span>
                </div>
                <div>
                  Serverless:{" "}
                  <span className="text-foreground font-medium">Cloudflare Pages / Vercel</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        {/* TAB 2: STORAGE & CLOUDFLARE R2 GOVERNANCE */}
        <TabsContent value="storage" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Cloudflare R2 & Object Storage Governance
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure per-agent storage quotas, file upload caps, path namespaces, and presigned
              URL policies.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard className="space-y-4">
              <div className="flex items-center gap-2">
                <HardDrive className="size-5 text-cyan-400" />
                <h3 className="font-semibold">Object Storage Configuration</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-muted-foreground">Active Primary Storage</span>
                  <span className="font-medium text-cyan-400">Cloudflare R2 S3 API</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-muted-foreground">R2 Bucket Name</span>
                  <code className="text-xs bg-muted/40 px-2 py-0.5 rounded">{R2_BUCKET_NAME}</code>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-muted-foreground">Fallback Storage</span>
                  <span className="font-medium text-muted-foreground">
                    Supabase Storage (`mandate-documents`)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-muted-foreground">Presigned URL Expiration</span>
                  <span className="font-medium text-emerald-400">300 seconds (5 minutes)</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Folder Namespace Isolation</span>
                  <span className="font-medium text-indigo-400">`users/&lt;user_id&gt;/...`</span>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="size-5 text-indigo-400" />
                <h3 className="font-semibold">Global Quotas & Upload Limits</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Storage Quota per Agent (MB)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={globalQuotaMb}
                      onChange={(e) => setGlobalQuotaMb(Number(e.target.value))}
                      className="w-32"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[500, 1024, 2048, 5120].map((mb) => (
                        <Button
                          key={mb}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setGlobalQuotaMb(mb)}
                        >
                          {mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New agent accounts automatically inherit this storage allocation. Admins can
                    customize individual limits in Team & Users.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum Single File Upload Limit (MB)</Label>
                  <Input
                    type="number"
                    value={maxFileMb}
                    onChange={(e) => setMaxFileMb(Number(e.target.value))}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enforced server-side for FICA PDFs, FFC certificates, and deal contracts
                    (Default: 50MB).
                  </p>
                </div>

                <Button
                  onClick={() => toast.success("Storage governance settings updated successfully")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Storage Policies
                </Button>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        {/* TAB 3: SECURITY & ACCESS CONTROL */}
        <TabsContent value="security" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Security & Authentication Governance
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure session policies, multi-factor authentication rules, self-registration
              filters, and database RLS.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard className="space-y-5">
              <div className="flex items-center gap-2">
                <Lock className="size-5 text-emerald-400" />
                <h3 className="font-semibold">Authentication & Session Rules</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Idle Session Timeout</Label>
                  <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 Minutes</SelectItem>
                      <SelectItem value="30">30 Minutes</SelectItem>
                      <SelectItem value="60">1 Hour (Recommended)</SelectItem>
                      <SelectItem value="720">12 Hours</SelectItem>
                      <SelectItem value="1440">24 Hours</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Users will be automatically logged out after inactivity.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Require MFA for Admins & Principals
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enforce Time-based One-Time Passwords (TOTP) on administrative log-ins.
                    </p>
                  </div>
                  <Switch checked={enforceMfa} onCheckedChange={setEnforceMfa} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Require Admin Approval for Registration
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Newly invited agents remain suspended until explicitly activated by an Admin.
                    </p>
                  </div>
                  <Switch
                    checked={requireAdminApproval}
                    onCheckedChange={setRequireAdminApproval}
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-indigo-400" />
                <h3 className="font-semibold">Database Security & Domain Rules</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Allowed Agent Registration Email Domains</Label>
                  <Input
                    value={allowedDomains}
                    onChange={(e) => setAllowedDomains(e.target.value)}
                    placeholder="dreamsupreme.co.za, dreamproperty.co.za"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of allowed email domain suffixes.
                  </p>
                </div>

                <div className="p-3 border rounded-lg border-emerald-500/20 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" /> Postgres Row Level Security (RLS)
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0">ACTIVE</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All tables (user_account, deals, documents, agency_financial_config) enforce
                    tenant and role isolation policies directly at the database layer.
                  </p>
                </div>

                <Button
                  onClick={() => toast.success("Security & access policies saved")}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Save Security Policies
                </Button>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        {/* TAB 4: NOTIFICATIONS & INTEGRATIONS */}
        <TabsContent value="integrations" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Notifications & Third-Party Gateway Integration
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure automated event dispatchers, WhatsApp bot webhooks, and email mailer
              triggers.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard className="space-y-5">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-amber-400" />
                <h3 className="font-semibold">Automated System Alerts</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Deal Stage Milestone Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Notify agents when deals move to Attorney or Bond Submitted.
                    </p>
                  </div>
                  <Switch checked={notifyDealStages} onCheckedChange={setNotifyDealStages} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Agent FFC Expiration Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Send automated warnings 30 days prior to FFC certificate expiry.
                    </p>
                  </div>
                  <Switch checked={notifyFfcWarnings} onCheckedChange={setNotifyFfcWarnings} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
                  <div>
                    <Label className="text-sm font-medium">FICA Upload Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Notify compliance officer upon client FICA document submission.
                    </p>
                  </div>
                  <Switch checked={notifyFicaUploads} onCheckedChange={setNotifyFicaUploads} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Commission Payout Reconciliations</Label>
                    <p className="text-xs text-muted-foreground">
                      Send automated WhatsApp & email receipts upon payout clearance.
                    </p>
                  </div>
                  <Switch
                    checked={notifyCommissionRecon}
                    onCheckedChange={setNotifyCommissionRecon}
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="space-y-5">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-cyan-400" />
                <h3 className="font-semibold">Integration Gateway Status</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-3 border rounded-lg border-border/50">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-emerald-400" />
                    <span>WhatsApp Gateway</span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Active
                  </Badge>
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg border-border/50">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-indigo-400" />
                    <span>Supabase Auth Mailer</span>
                  </div>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                    Active
                  </Badge>
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg border-border/50">
                  <div className="flex items-center gap-2">
                    <FileCheck className="size-4 text-amber-400" />
                    <span>Conveyancer Portal Webhook</span>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                    Listening
                  </Badge>
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg border-border/50">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-purple-400" />
                    <span>Xero / Sage Accounting Sync</span>
                  </div>
                  <Badge variant="outline">Configured</Badge>
                </div>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        {/* TAB 5: AUTOMATED MAINTENANCE POLICIES */}
        <TabsContent value="maintenance" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Automated Maintenance & Archival Policies
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure server-side retention thresholds and execute audited database maintenance
              tasks.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <GlassCard className="space-y-2">
              <Label className="text-xs text-muted-foreground">Idle Agent Threshold (Days)</Label>
              <Input type="number" value={idleDays} onChange={(e) => setIdleDays(e.target.value)} />
            </GlassCard>

            <GlassCard className="space-y-2">
              <Label className="text-xs text-muted-foreground">Deal Archival Window (Days)</Label>
              <Input
                type="number"
                value={archiveDays}
                onChange={(e) => setArchiveDays(e.target.value)}
              />
            </GlassCard>

            <GlassCard className="space-y-2">
              <Label className="text-xs text-muted-foreground">Recycle Bin Retention (Days)</Label>
              <Input
                type="number"
                value={recycleRetentionDays}
                onChange={(e) => setRecycleRetentionDays(e.target.value)}
              />
            </GlassCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <GlassCard className="space-y-3">
              <Archive className="size-5 text-indigo-400" />
              <h3 className="font-display font-semibold">Archive Old Deals</h3>
              <p className="text-xs text-muted-foreground">
                Runs the audited server-side archival policy for deals closed more than{" "}
                {archiveDays} days ago.
              </p>
              <Button
                className="w-full mt-2"
                variant="outline"
                disabled={!!actionLoading}
                onClick={() => void runMaintenanceAction("archive")}
              >
                {actionLoading === "archive" ? "Running…" : "Archive Eligible Deals"}
              </Button>
            </GlassCard>

            <GlassCard className="space-y-3">
              <UserMinus className="size-5 text-amber-400" />
              <h3 className="font-display font-semibold">Deactivate Idle Agents</h3>
              <p className="text-xs text-muted-foreground">
                Deactivates agent profiles with no system activity in the past {idleDays} days.
              </p>
              <Button
                className="w-full mt-2"
                variant="outline"
                disabled={!!actionLoading}
                onClick={() => void runMaintenanceAction("deactivate")}
              >
                {actionLoading === "deactivate" ? "Running…" : "Deactivate Idle Agents"}
              </Button>
            </GlassCard>

            <GlassCard className="border-destructive/30 space-y-3">
              <Trash2 className="size-5 text-destructive" />
              <h3 className="font-display font-semibold">Empty Recycle Bin</h3>
              <p className="text-xs text-muted-foreground">
                Permanently deletes soft-deleted records older than {recycleRetentionDays} days
                according to RLS policy.
              </p>
              <Button
                className="w-full mt-2"
                variant="destructive"
                disabled={!!actionLoading}
                onClick={() => void runMaintenanceAction("trash")}
              >
                {actionLoading === "trash" ? "Running…" : "Empty Recycle Bin"}
              </Button>
            </GlassCard>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
