import { useEffect, useState } from "react";
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
import { R2_BUCKET_NAME } from "@/lib/storage";
import { useAgencySystemSettings, useSaveAgencySystemSettings } from "@/data/system-settings";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

type Action = "archive" | "deactivate" | "trash";

function AdminSettings() {
  const { account } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [actionLoading, setActionLoading] = useState<Action | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<{
    dbMs: number;
    whatsappQueueCount: number;
    userCount: number;
  } | null>(null);

  // Database System Settings Hooks
  const { data: dbSettings } = useAgencySystemSettings();
  const saveSettings = useSaveAgencySystemSettings();

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

  // Sync state with Database when settings load
  useEffect(() => {
    if (dbSettings) {
      setGlobalQuotaMb(dbSettings.globalStorageQuotaMb);
      setMaxFileMb(dbSettings.maxFileUploadMb);
      setSessionTimeout(String(dbSettings.sessionTimeoutMinutes));
      setEnforceMfa(dbSettings.enforceMfa);
      setRequireAdminApproval(dbSettings.requireAdminApproval);
      setAllowedDomains(dbSettings.allowedDomains);
      setNotifyDealStages(dbSettings.notifyDealStages);
      setNotifyFfcWarnings(dbSettings.notifyFfcWarnings);
      setNotifyFicaUploads(dbSettings.notifyFicaUploads);
      setNotifyCommissionRecon(dbSettings.notifyCommissionRecon);
      setIdleDays(String(dbSettings.idleAgentDays));
      setArchiveDays(String(dbSettings.dealArchiveDays));
      setRecycleRetentionDays(String(dbSettings.recycleBinRetentionDays));
    }
  }, [dbSettings]);

  async function handleSaveSettings(
    partial: Parameters<typeof saveSettings.mutateAsync>[0],
    successMessage: string,
  ) {
    try {
      await saveSettings.mutateAsync(partial);
      toast.success(successMessage, {
        description: "Configuration persisted to database.",
      });
    } catch (err: any) {
      toast.error("Failed to save settings", { description: err.message });
    }
  }

  async function runPingTest(showToast = true) {
    setPingLoading(true);
    const start = performance.now();
    try {
      // 1. Live Query to Supabase DB
      const { count: usersCount, error: dbErr } = await supabase
        .from("user_account")
        .select("*", { count: "exact", head: true });
      const dbMs = Math.round(performance.now() - start);

      if (dbErr) throw dbErr;

      // 2. Query Live WhatsApp Queue Count
      const { count: waCount } = await supabase
        .from("whatsapp_queue")
        .select("*", { count: "exact", head: true });

      setPingResult({
        dbMs,
        whatsappQueueCount: waCount ?? 0,
        userCount: usersCount ?? 0,
      });

      if (showToast) {
        toast.success("Live Diagnostics Complete", {
          description: `Database Latency: ${dbMs}ms | Active Users: ${usersCount ?? 0} | WhatsApp Queue: ${waCount ?? 0} messages`,
        });
      }
    } catch (err: any) {
      if (showToast) {
        toast.error("Diagnostics Failed", { description: err.message });
      }
    } finally {
      setPingLoading(false);
    }
  }

  // Run live diagnostics automatically on mount
  useEffect(() => {
    void runPingTest(false);
  }, []);

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
        description="Manage system infrastructure health, document storage policies, security controls, notifications, and maintenance."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-card/60 border border-border/50 p-1 rounded-xl">
          <TabsTrigger value="general" className="flex items-center gap-2 text-xs sm:text-sm">
            <Server className="size-4 text-indigo-500" />
            <span>General & Health</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-2 text-xs sm:text-sm">
            <HardDrive className="size-4 text-cyan-500" />
            <span>Storage</span>
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
              onClick={() => void runPingTest(true)}
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
                  <span className="font-semibold text-sm">Document Storage</span>
                </div>
                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  <CheckCircle2 className="size-3 mr-1" /> Supabase Storage
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Bucket: <code className="text-cyan-300">{R2_BUCKET_NAME}</code>. Direct R2 access
                from the browser is disabled — Cloudflare R2 credentials cannot be scoped safely to
                the client, so uploads/downloads go through Supabase Storage's agency-scoped RLS
                policies instead.
              </p>
              {pingResult && (
                <div className="text-xs font-mono bg-muted/30 p-2 rounded border text-cyan-400">
                  R2 Adapter: Disabled (Supabase Storage fallback active)
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
                Supabase Auth with role-based JWT claims (Admin, Agent).
              </p>
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-emerald-400" />
                  <span className="font-semibold text-sm">WhatsApp Business API</span>
                </div>
                {import.meta.env.VITE_WHATSAPP_API_TOKEN ||
                import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <Radio className="size-3 mr-1 animate-pulse" /> Ready
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-border/40">
                    Not Configured
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {import.meta.env.VITE_WHATSAPP_API_TOKEN ||
                import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID
                  ? "Automated document & lead notification webhook gateway listening."
                  : "Meta WhatsApp API token missing in environment variables."}
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

        {/* TAB 2: OBJECT STORAGE GOVERNANCE */}
        <TabsContent value="storage" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Object Storage Governance</h2>
            <p className="text-sm text-muted-foreground">
              Configure per-agent storage quotas, file upload caps, path namespaces, and signed URL
              policies.
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
                  <span className="text-muted-foreground">Active Storage Backend</span>
                  <span className="font-medium text-cyan-400">
                    Supabase Storage (`mandate-documents`)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-muted-foreground">Cloudflare R2</span>
                  <span className="font-medium text-muted-foreground">
                    Disabled (client-side R2 credentials can't be scoped safely)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-muted-foreground">Configured R2 Bucket Name</span>
                  <code className="text-xs bg-muted/40 px-2 py-0.5 rounded">{R2_BUCKET_NAME}</code>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/40">
                  <span className="text-muted-foreground">Signed URL Expiration</span>
                  <span className="font-medium text-emerald-400">300 seconds (5 minutes)</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Folder Namespace Isolation</span>
                  <span className="font-medium text-indigo-400">
                    `&lt;agency_id&gt;/...` and `users/&lt;user_id&gt;/...`
                  </span>
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
                  disabled={saveSettings.isPending}
                  onClick={() =>
                    void handleSaveSettings(
                      {
                        globalStorageQuotaMb: globalQuotaMb,
                        maxFileUploadMb: maxFileMb,
                      },
                      "Storage governance policies saved",
                    )
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saveSettings.isPending ? "Saving…" : "Save Storage Policies"}
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
                    <Label className="text-sm font-medium">Require MFA for Admins</Label>
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
                  disabled={saveSettings.isPending}
                  onClick={() =>
                    void handleSaveSettings(
                      {
                        sessionTimeoutMinutes: Number(sessionTimeout),
                        enforceMfa,
                        requireAdminApproval,
                        allowedDomains,
                      },
                      "Security & access policies saved",
                    )
                  }
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saveSettings.isPending ? "Saving…" : "Save Security Policies"}
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

                <Button
                  disabled={saveSettings.isPending}
                  onClick={() =>
                    void handleSaveSettings(
                      {
                        notifyDealStages,
                        notifyFfcWarnings,
                        notifyFicaUploads,
                        notifyCommissionRecon,
                      },
                      "Notification dispatch policies saved",
                    )
                  }
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white mt-4"
                >
                  {saveSettings.isPending ? "Saving…" : "Save Notification Policies"}
                </Button>
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
                  {import.meta.env.VITE_WHATSAPP_API_TOKEN ||
                  import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/40">
                      Not Configured
                    </Badge>
                  )}
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg border-border/50">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-indigo-400" />
                    <span>Supabase Auth Mailer</span>
                  </div>
                  {import.meta.env.VITE_SUPABASE_URL ? (
                    <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/40">
                      Not Configured
                    </Badge>
                  )}
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg border-border/50">
                  <div className="flex items-center gap-2">
                    <FileCheck className="size-4 text-amber-400" />
                    <span>Conveyancer Portal Webhook</span>
                  </div>
                  {import.meta.env.VITE_CONVEYANCER_WEBHOOK_URL ? (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Listening
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/40">
                      Not Configured
                    </Badge>
                  )}
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg border-border/50">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-purple-400" />
                    <span>Xero / Sage Accounting Sync</span>
                  </div>
                  {import.meta.env.VITE_XERO_CLIENT_ID || import.meta.env.VITE_SAGE_API_KEY ? (
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/40">
                      Not Configured
                    </Badge>
                  )}
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

          <div className="flex justify-end mb-6">
            <Button
              disabled={saveSettings.isPending}
              onClick={() =>
                void handleSaveSettings(
                  {
                    idleAgentDays: Number(idleDays),
                    dealArchiveDays: Number(archiveDays),
                    recycleBinRetentionDays: Number(recycleRetentionDays),
                  },
                  "Maintenance retention thresholds saved",
                )
              }
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {saveSettings.isPending ? "Saving…" : "Save Retention Thresholds"}
            </Button>
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
