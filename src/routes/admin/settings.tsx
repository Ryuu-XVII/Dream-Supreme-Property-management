import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  Save,
  Building2,
  Wallet,
  Link as LinkIcon,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const { account } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    toast.success("System settings updated successfully.");
  }

  async function handleArchiveDeals() {
    if (!account) return;
    if (confirm("Are you sure you want to archive old deals?")) {
      setLoading("archive");
      const { data, error } = await supabase.rpc("admin_archive_old_deals", {
        p_agency_id: account.agencyId,
      });

      if (error) {
        toast.error("Failed to archive deals: " + error.message);
      } else {
        toast.success(`${data} old deals have been archived.`);
      }
      setLoading(null);
    }
  }

  async function handleDeactivateAgents() {
    if (!account) return;
    if (confirm("Are you sure you want to deactivate idle agents?")) {
      setLoading("deactivate");
      const { data, error } = await supabase.rpc("admin_deactivate_idle_agents", {
        p_agency_id: account.agencyId,
      });

      if (error) {
        toast.error("Failed to deactivate agents: " + error.message);
      } else {
        toast.success(`${data} idle agents have been deactivated.`);
      }
      setLoading(null);
    }
  }

  async function handleEmptyTrash() {
    if (!account) return;
    if (
      confirm("Are you absolutely sure you want to empty the recycle bin? This cannot be undone.")
    ) {
      setLoading("trash");
      const { data, error } = await supabase.rpc("admin_empty_recycle_bin", {
        p_agency_id: account.agencyId,
      });

      if (error) {
        toast.error("Failed to empty trash: " + error.message);
      } else {
        const d = data as any;
        toast.success(
          `Trash emptied: ${d.deals} deals, ${d.properties} properties, ${d.parties} clients deleted.`,
        );
      }
      setLoading(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="System Settings"
        description="Configure global administrative parameters, integrations, and financial defaults."
      />
      <div className="max-w-4xl">
        <Tabs defaultValue="financial" className="w-full">
          <TabsList className="mb-6 grid w-full max-w-2xl grid-cols-4 bg-slate-900/50">
            <TabsTrigger value="operations" className="gap-2">
              <Building2 className="size-4" /> Operations
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <Wallet className="size-4" /> Financial
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <LinkIcon className="size-4" /> Integrations
            </TabsTrigger>
            <TabsTrigger
              value="danger"
              className="gap-2 text-red-500 data-[state=active]:text-red-500"
            >
              <AlertTriangle className="size-4" /> Danger
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-6">
            <GlassCard>
              <h3 className="font-display text-base font-semibold mb-4">Operational Settings</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-indigo-200 dark:border-indigo-900/50 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-indigo-600 dark:text-indigo-400" />
                      <Label className="text-base font-medium text-indigo-900 dark:text-indigo-300">
                        Identity and Compliance (FICA)
                      </Label>
                    </div>
                    <p className="text-sm text-indigo-700/80 dark:text-indigo-400/80">
                      Identity and compliance documents are strictly enforced across the agency for
                      all new deals in accordance with South African FICA law. This cannot be
                      bypassed.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-background/30">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Lead Auto-Assignment</Label>
                    <p className="text-sm text-muted-foreground">
                      Lead distribution is now managed at the Branch level. To enable round-robin
                      auto-assignment, please edit the specific Branch settings in your Agency
                      profile.
                    </p>
                  </div>
                  <Link
                    to="/admin/agency"
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Manage Branches
                  </Link>
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="size-4 mr-2" /> Save Settings
                  </Button>
                </div>
              </form>
            </GlassCard>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="size-5 text-indigo-500" />
                <h3 className="font-display text-base font-semibold">
                  Financial & Accounting Controls
                </h3>
              </div>
              <form onSubmit={handleSave} className="space-y-8">
                {/* Core Financial Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground border-b border-border pb-2">
                    Core Settings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>Default Currency</Label>
                      <Select defaultValue="ZAR">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Default VAT Rate (%)</Label>
                      <Input type="number" defaultValue="15" />
                    </div>
                    <div className="space-y-2">
                      <Label>Agency VAT Registration Number</Label>
                      <Input defaultValue="4123456789" />
                    </div>
                  </div>
                </div>

                {/* Trust Accounting */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground border-b border-border pb-2">
                    Trust Accounting (Section 86)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Interest Distribution to Fidelity Fund (%)</Label>
                      <Input type="number" defaultValue="50" max="100" />
                      <p className="text-xs text-muted-foreground">
                        Statutory requirement for Section 86(1) accounts.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Interest Distribution to Agency (%)</Label>
                      <Input type="number" defaultValue="50" max="100" />
                    </div>
                    <div className="space-y-2 flex flex-col justify-end">
                      <div className="flex items-center justify-between">
                        <Label>Require Principal Approval for Trust Payouts</Label>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reporting & Compliance */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground border-b border-border pb-2">
                    Reporting & Commission
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Financial Year End</Label>
                      <Select defaultValue="feb">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="feb">February (Standard SA)</SelectItem>
                          <SelectItem value="dec">December</SelectItem>
                          <SelectItem value="jun">June</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Global Commission Rules</Label>
                      <p className="text-xs text-muted-foreground pb-2">
                        Tax rates, desk fees, franchise fees, and default company cuts are managed
                        in the centralized Rules Engine.
                      </p>
                      <Link
                        to="/admin/commission-rules"
                        className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground w-full"
                      >
                        Manage Commission Rules
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="size-4 mr-2" /> Save Financial Settings
                  </Button>
                </div>
              </form>
            </GlassCard>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <GlassCard>
              <h3 className="font-display text-base font-semibold mb-4">
                Third-Party Integrations
              </h3>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-indigo-500" />
                    <h4 className="font-medium">Property Portals</h4>
                  </div>
                  <div className="pl-7 space-y-4">
                    <div className="space-y-2">
                      <Label>Property24 Connection Key</Label>
                      <Input type="password" defaultValue="************************" />
                      <p className="text-xs text-muted-foreground">
                        Used to automatically share new properties to Property24.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Private Property Connection Key</Label>
                      <Input type="password" placeholder="Enter Connection Key" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-emerald-500" />
                    <h4 className="font-medium">WhatsApp Business API</h4>
                  </div>
                  <div className="pl-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Automated WhatsApp Notifications</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically send bond updates and rent reminders to clients via
                          WhatsApp.
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Phone Number ID</Label>
                      <Input defaultValue="27820001111" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-5 text-blue-500" />
                    <h4 className="font-medium">Accounting Integration (Xero)</h4>
                  </div>
                  <div className="pl-7 space-y-4">
                    <div className="flex items-center justify-between p-4 border border-blue-200 dark:border-blue-900/50 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <div className="space-y-1">
                        <Label className="text-blue-900 dark:text-blue-300">Xero Connection</Label>
                        <p className="text-xs text-blue-700/80 dark:text-blue-400/80">
                          Sync your Section 86 Trust Ledger automatically with your Xero accounting
                          suite.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white dark:bg-background"
                      >
                        Connect to Xero
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-border flex justify-end">
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="size-4 mr-2" /> Save Settings
                  </Button>
                </div>
              </form>
            </GlassCard>
          </TabsContent>

          <TabsContent value="danger" className="space-y-6">
            <GlassCard>
              <h3 className="font-display text-base font-semibold text-red-600 mb-4 flex items-center gap-2">
                <AlertTriangle className="size-5" /> Danger Zone
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Irreversible destructive actions. Please be careful.
              </p>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-950/20 gap-4">
                  <div>
                    <h4 className="font-medium text-red-900 dark:text-red-400">
                      Archive Old Deals
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-500/70 mt-1">
                      Move closed and registered deals older than 3 years to cold storage to
                      optimize performance.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleArchiveDeals}
                    disabled={loading !== null}
                  >
                    {loading === "archive" ? "Archiving..." : "Archive Deals"}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-950/20 gap-4">
                  <div>
                    <h4 className="font-medium text-red-900 dark:text-red-400">
                      Deactivate Idle Agents
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-500/70 mt-1">
                      Suspend agent accounts that have been inactive for more than 90 days.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDeactivateAgents}
                    disabled={loading !== null}
                  >
                    {loading === "deactivate" ? "Deactivating..." : "Deactivate Agents"}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-950/20 gap-4">
                  <div>
                    <h4 className="font-medium text-red-900 dark:text-red-400">
                      Empty System Recycle Bin
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-500/70 mt-1">
                      Permanently delete all items in the trash, including deleted contacts, leads,
                      and listings.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleEmptyTrash}
                    disabled={loading !== null}
                  >
                    {loading === "trash" ? "Emptying..." : "Empty Trash"}
                  </Button>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
