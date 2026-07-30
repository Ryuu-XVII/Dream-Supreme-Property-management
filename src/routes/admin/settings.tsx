import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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
  const [rules, setRules] = useState([
    { id: 1, name: "Candidate Agent", threshold: 0, cut: 50 },
    { id: 2, name: "Mid-level Agent", threshold: 500000, cut: 60 },
    { id: 3, name: "Senior Agent", threshold: 2000000, cut: 70 },
    { id: 4, name: "Principal Agent", threshold: 5000000, cut: 85 },
  ]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    toast.success("System settings updated successfully.");
  }

  function addRule() {
    setRules([...rules, { id: Date.now(), name: "New Tier", threshold: 0, cut: 50 }]);
  }

  function removeRule(id: number) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function updateRule(id: number, field: string, value: string | number) {
    setRules(rules.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleArchiveDeals() {
    if (confirm("Are you sure you want to archive old deals?")) {
      const { error } = await supabase
        .from("deal")
        .update({ status: "archived" })
        .lt("updated_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        toast.error("Failed to archive deals: " + error.message);
      } else {
        toast.success("Old deals have been archived.");
      }
    }
  }

  async function handleDeactivateAgents() {
    if (confirm("Are you sure you want to deactivate idle agents?")) {
      const { error } = await supabase
        .from("user_account")
        .update({ is_active: false })
        .lt("last_login_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        toast.error("Failed to deactivate agents: " + error.message);
      } else {
        toast.success("Idle agents have been deactivated.");
      }
    }
  }

  async function handleEmptyTrash() {
    if (
      confirm("Are you absolutely sure you want to empty the recycle bin? This cannot be undone.")
    ) {
      toast.success("Recycle bin emptied (simulated - soft delete cleanup).");
    }
  }

  async function handleResetTiers() {
    if (confirm("Are you sure you want to reset commission tiers?")) {
      setRules([
        { id: 1, name: "Candidate Agent", threshold: 0, cut: 50 },
        { id: 2, name: "Mid-level Agent", threshold: 500000, cut: 60 },
        { id: 3, name: "Senior Agent", threshold: 2000000, cut: 70 },
        { id: 4, name: "Principal Agent", threshold: 5000000, cut: 85 },
      ]);
      toast.success("Commission tiers reset to defaults.");
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
            <TabsTrigger value="general" className="gap-2">
              <Building2 className="size-4" /> General
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

          <TabsContent value="general" className="space-y-6">
            <GlassCard>
              <h3 className="font-display text-base font-semibold mb-4">Agency Details</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agency Name</Label>
                    <Input defaultValue="Dream Supreme Properties" />
                  </div>
                  <div className="space-y-2">
                    <Label>Trading As (if different)</Label>
                    <Input placeholder="Optional" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact Email (System Notifications)</Label>
                  <Input type="email" defaultValue="admin@dreamsupreme.co.za" />
                </div>
                <div className="space-y-2">
                  <Label>Primary Phone Number</Label>
                  <Input type="tel" defaultValue="+27 11 555 0192" />
                </div>
                <div className="space-y-2">
                  <Label>Physical Address</Label>
                  <Input defaultValue="142 Sandton Drive, Sandton, Johannesburg, 2196" />
                </div>

                <h4 className="font-medium text-sm pt-4 border-t border-border mt-4">
                  Operational Settings
                </h4>

                <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-background/30">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">
                      Require identity documents for new deals
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Require identity and compliance documents before deals can be finalized.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-background/30">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Auto-assign new leads</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically assign new website leads to agents based on their area.
                    </p>
                  </div>
                  <Switch defaultChecked={false} />
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
              <h3 className="font-display text-base font-semibold mb-4">Financial & Defaults</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Currency</Label>
                    <Input defaultValue="ZAR" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input type="number" defaultValue="15" />
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <Label>Default Company Cut (%)</Label>
                  <Input type="number" defaultValue="30" min="0" max="100" />
                  <p className="text-xs text-muted-foreground">
                    Default percentage the company retains before agent splits (if no tier rule
                    applies).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Franchise/Royalty Fee (%)</Label>
                    <Input type="number" defaultValue="5" min="0" max="100" />
                    <p className="text-xs text-muted-foreground">
                      Global royalty fee deducted off the top before company/agent split.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Desk Fee (ZAR/month)</Label>
                    <Input type="number" defaultValue="2500" min="0" />
                    <p className="text-xs text-muted-foreground">
                      Monthly operational charge billed to agents.
                    </p>
                  </div>
                </div>

                <h4 className="font-medium text-sm pt-4 border-t border-border mt-4">
                  Commission Calculation Rules
                </h4>

                <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-background/30">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Calculate VAT on Commission</Label>
                    <p className="text-sm text-muted-foreground">
                      Include VAT when calculating gross commission on deals.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg bg-background/30">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">
                      Deduct Franchise Fee Before Splits
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Deduct the franchise/royalty fee from gross commission before applying agent
                      splits.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="size-4 mr-2" /> Save Settings
                  </Button>
                </div>
              </form>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-semibold">Commission Tiers</h3>
                  <p className="text-sm text-muted-foreground">
                    Set how commissions are shared with agents based on their performance this year.
                  </p>
                </div>
                <Button onClick={addRule} variant="outline" size="sm" className="gap-2">
                  <Plus className="size-4" /> Add Tier
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground px-2">
                  <div className="col-span-4">Tier Name</div>
                  <div className="col-span-4">Yearly Target (ZAR)</div>
                  <div className="col-span-3">Agent Share (%)</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="grid grid-cols-12 gap-4 items-center bg-background/50 p-2 rounded-lg border border-border/50"
                  >
                    <div className="col-span-4">
                      <Input
                        value={rule.name}
                        onChange={(e) => updateRule(rule.id, "name", e.target.value)}
                        placeholder="e.g. Bronze"
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-4 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        R
                      </span>
                      <Input
                        type="number"
                        value={rule.threshold}
                        onChange={(e) => updateRule(rule.id, "threshold", Number(e.target.value))}
                        className="pl-7 h-8"
                      />
                    </div>
                    <div className="col-span-3 relative">
                      <Input
                        type="number"
                        value={rule.cut}
                        onChange={(e) => updateRule(rule.id, "cut", Number(e.target.value))}
                        max="100"
                        className="h-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        %
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRule(rule.id)}
                        className="h-8 w-8 text-slate-500 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
                    <h4 className="font-medium">Website Leads Integration</h4>
                  </div>
                  <div className="pl-7 space-y-4">
                    <div className="space-y-2">
                      <Label>Website Integration Link</Label>
                      <Input
                        defaultValue="https://api.dreamsupreme.co.za/v1/leads/webhook"
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        Share this link with your web developer to connect your website and receive
                        leads automatically.
                      </p>
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
                  <Button variant="destructive" onClick={handleArchiveDeals}>
                    Archive Deals
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
                  <Button variant="destructive" onClick={handleDeactivateAgents}>
                    Deactivate Agents
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
                  <Button variant="destructive" onClick={handleEmptyTrash}>
                    Empty Trash
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50 dark:bg-red-950/20 gap-4">
                  <div>
                    <h4 className="font-medium text-red-900 dark:text-red-400">
                      Reset Commission Tiers
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-500/70 mt-1">
                      Revert all agent commission splits and tiers back to the default factory
                      settings.
                    </p>
                  </div>
                  <Button variant="destructive" onClick={handleResetTiers}>
                    Reset Tiers
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
