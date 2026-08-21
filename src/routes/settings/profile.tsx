import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

import { AgentComplianceDocuments } from "@/components/settings/agent-compliance-documents";
import { AgentProperty24Listings } from "@/components/settings/agent-property24-listings";
import { MfaSettings } from "@/components/settings/mfa-settings";
import { ProfilePhoto } from "@/components/settings/profile-photo";

export const Route = createFileRoute("/settings/profile")({
  head: () => ({ meta: [{ title: "My Profile | Dream Supreme Properties" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { account, refreshAccount, isReadOnly } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!account) return;
    setFullName(account.fullName);
    setEmail(account.email);
    setMobile(account.telephone ?? "");
  }, [account]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to edit the profile.");
    if (!account || !fullName.trim() || !email.trim())
      return toast.error("Name and email are required.");
    setSaving(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase
        .from("user_account")
        .update({
          full_name: fullName.trim(),
          email: normalizedEmail,
          mobile: mobile.trim() || null,
        })
        .eq("id", account.id);
      if (!error && normalizedEmail !== account.email) {
        const authResult = await supabase.auth.updateUser({ email: normalizedEmail });
        if (authResult.error) {
          return toast.error(authResult.error.message);
        }
      }
      if (error) toast.error(error.message);
      else {
        await refreshAccount();
        toast.success(
          normalizedEmail !== account.email
            ? "Profile saved. Confirm the new email from your inbox."
            : "Profile saved",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to change the password.");
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    if (!currentPassword || !account?.email) return toast.error("Enter your current password.");
    setPasswordSaving(true);
    try {
      const verified = await supabase.auth.signInWithPassword({
        email: account.email,
        password: currentPassword,
      });
      if (verified.error) {
        return toast.error("Current password is incorrect.");
      }
      const result = await supabase.auth.updateUser({ password: newPassword });
      if (result.error) toast.error(result.error.message);
      else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Password updated");
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <AppShell title="Settings" description="Manage your persisted account information.">
      <SettingsTabs />
      <div className="grid gap-6 lg:grid-cols-3">
        <ProfilePhoto />
        <GlassCard className="lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold">
            <User className="size-4 text-primary" /> Personal information
          </h2>
          <p className="mb-6 text-xs text-muted-foreground">
            Changes are saved to your user account.
          </p>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <Label htmlFor="full-name">Full name</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="full-name"
                  className="pl-9"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  className="pl-9"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mobile">Mobile</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="mobile"
                  className="pl-9"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                />
              </div>
            </div>
            <Button disabled={saving || isReadOnly}>
              {isReadOnly ? "Read-Only Mode" : saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </GlassCard>
        <GlassCard>
          <h2 className="font-display text-base font-semibold">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="capitalize">{account?.role ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Branch</dt>
              <dd>{account?.branchId ?? "Not assigned"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="capitalize">{account?.status ?? "—"}</dd>
            </div>
          </dl>
        </GlassCard>
        <AgentComplianceDocuments />
        <AgentProperty24Listings userId={account?.id} canSync={!isReadOnly} />
        <MfaSettings />
        <GlassCard className="lg:col-span-3">
          <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold">
            <ShieldCheck className="size-4 text-primary" /> Password
          </h2>
          <form onSubmit={updatePassword} className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <div className="sm:col-span-3">
              <Button variant="outline" disabled={passwordSaving || isReadOnly}>
                {isReadOnly ? "Read-Only Mode" : passwordSaving ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </GlassCard>
      </div>
    </AppShell>
  );
}
