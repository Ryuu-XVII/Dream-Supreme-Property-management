import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Building,
  BadgeCheck,
  FileText,
  Upload,
  Camera,
  Download,
  FileCheck,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { agency } from "@/data/mock";
import { dateFmt, initials } from "@/lib/format";

export const Route = createFileRoute("/settings/profile")({
  head: () => ({
    meta: [
      { title: "My Profile | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Manage your personal agent profile, contact information and FFC compliance details.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { account } = useAuth();
  const [fullName, setFullName] = useState(account?.fullName ?? "Agent User");
  const [email, setEmail] = useState(account?.email ?? "agent@dreamsupreme.co.za");
  const [telephone, setTelephone] = useState(account?.telephone ?? "+27 82 555 0199");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [ffcDocumentName, setFfcDocumentName] = useState<string | null>("FFC_Certificate_2026.pdf");
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const ffcInputRef = useRef<HTMLInputElement>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      toast.success("Profile photo updated");
    }
  }

  function handleFfcUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFfcDocumentName(file.name);
      toast.success("FFC Document uploaded", { description: file.name });
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Profile details updated successfully");
    }, 400);
  }

  const ffcExpiry = "2026-12-31";

  return (
    <AppShell title="Settings" description="Manage your account profile and preferences.">
      <SettingsTabs />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <User className="size-4 text-primary" /> Personal Information
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Update your contact details displayed across deal documents and client messages.
          </p>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Upload Header */}
            <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="relative group">
                <Avatar className="size-20 border-2 border-primary/40 shadow-md">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">
                    {initials(fullName)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                  title="Change Profile Photo"
                >
                  <Camera className="size-5" />
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Profile Photo</p>
                <p className="text-xs text-muted-foreground">JPG, PNG or WEBP. Max size 5MB.</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" /> Upload Photo
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => setAvatarUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telephone">Mobile Number</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="telephone"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium capitalize">
                  {account?.role ?? "Agent"}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </GlassCard>

        <div className="space-y-6">
          {/* FFC Compliance & Document Upload Card */}
          <GlassCard>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" /> FFC Compliance
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Fidelity Fund Certificate status</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className="border-success/30 bg-success/10 text-success gap-1"
                >
                  <BadgeCheck className="size-3" /> Valid
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-border/60 pb-2">
                <span className="text-muted-foreground">FFC Number</span>
                <span className="font-mono font-medium">FFC-2026-8891</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Expiry Date</span>
                <span className="font-medium">{dateFmt(ffcExpiry)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-border/60 pb-2">
                <span className="text-muted-foreground">PPRA Ref</span>
                <span className="font-mono font-medium">PPRA-ZA-7721</span>
              </div>

              {/* FFC Certificate PDF Document Box */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  FFC Certificate Document
                </p>
                {ffcDocumentName ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="size-4 shrink-0 text-success" />
                      <span className="truncate font-medium">{ffcDocumentName}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => toast.info("Downloading FFC certificate...")}
                        title="Download Document"
                      >
                        <Download className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-primary"
                        onClick={() => ffcInputRef.current?.click()}
                        title="Replace Document"
                      >
                        <Upload className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => ffcInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" /> Upload FFC PDF
                  </Button>
                )}
                <input
                  ref={ffcInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={handleFfcUpload}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Building className="size-4 text-primary" /> Agency Affiliation
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Assigned agency & office</p>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-semibold">{agency.name}</p>
                <p className="text-xs text-muted-foreground">Head Office · Sandton, GP</p>
              </div>
              <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="size-3.5" /> FICA Registered Agency
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Security & Password Card */}
        <GlassCard className="lg:col-span-2">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Security & Authentication
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Update your account password and security settings.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Password updated successfully");
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="currPass">Current Password</Label>
                <Input id="currPass" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPass">New Password</Label>
                <Input id="newPass" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPass">Confirm New Password</Label>
                <Input id="confirmPass" type="password" placeholder="••••••••" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                  2FA Active
                </Badge>
                <span className="text-xs text-muted-foreground">Authenticator App linked</span>
              </div>
              <Button type="submit" variant="outline" size="sm">
                Update Password
              </Button>
            </div>
          </form>
        </GlassCard>

        {/* Property Portals Card */}
        <GlassCard className="lg:col-span-1">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Property Portal IDs
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Link listings to portal agent profiles
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Property24 Agent ID</Label>
              <Input defaultValue="P24-AGT-9021" className="h-8 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Private Property Code</Label>
              <Input defaultValue="PP-AG-4412" className="h-8 font-mono text-xs" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs mt-2"
              onClick={() => toast.success("Portal IDs saved")}
            >
              Save Portal IDs
            </Button>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
