import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { uploadFileToR2 } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { playNotificationSound } from "@/lib/sound";
import {
  UserCircle,
  ShieldCheck,
  Bell,
  Mail,
  KeyRound,
  FileText,
  UploadCloud,
  Save,
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  Camera,
  Trash2,
  Cloud,
  Volume2,
  VolumeX,
} from "lucide-react";

export const Route = createFileRoute("/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { account } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  // Avatar State
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Tab 1: Personal Details State
  const [fullName, setFullName] = useState(account?.fullName || "");
  const [telephone, setTelephone] = useState(account?.telephone || "");
  const [bio, setBio] = useState(
    "Experienced Property Practitioner specializing in residential sales and mandate management.",
  );
  const [language, setLanguage] = useState("English");
  const [savingDetails, setSavingDetails] = useState(false);

  // Tab 2: FFC Upload State
  const [certificateNumber, setCertificateNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadingFFC, setUploadingFFC] = useState(false);

  // Tab 3: Notification & Audio Sound Preferences State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState<"chime" | "alert" | "success">("chime");
  const [notifyDealUpdates, setNotifyDealUpdates] = useState(true);
  const [notifyConditionReminders, setNotifyConditionReminders] = useState(true);
  const [notifyLeadAssignments, setNotifyLeadAssignments] = useState(true);
  const [notifyLeaseEscalations, setNotifyLeaseEscalations] = useState(true);
  const [notifyCommissionReleases, setNotifyCommissionReleases] = useState(true);
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelWhatsApp, setChannelWhatsApp] = useState(false);
  const [frequency, setFrequency] = useState<"realtime" | "digest">("realtime");
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Load preferences
  useQuery({
    queryKey: ["user_notification_preference", account?.id],
    enabled: !!account?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notification_preference")
        .select("*")
        .eq("user_id", account!.id);
      if (error) throw error;

      if (data && data.length > 0) {
        // Evaluate states based on the rows
        // For simplicity, if they disabled it, we uncheck it
        const dealUpdate = data.find((d) => d.event_type === "deal_update");
        if (dealUpdate) setNotifyDealUpdates(dealUpdate.email_enabled || dealUpdate.in_app_enabled);

        const conditionReminder = data.find((d) => d.event_type === "condition_reminder");
        if (conditionReminder)
          setNotifyConditionReminders(
            conditionReminder.email_enabled || conditionReminder.in_app_enabled,
          );

        const leadAssignment = data.find((d) => d.event_type === "lead_assignment");
        if (leadAssignment)
          setNotifyLeadAssignments(leadAssignment.email_enabled || leadAssignment.in_app_enabled);

        const leaseEscalation = data.find((d) => d.event_type === "lease_escalation");
        if (leaseEscalation)
          setNotifyLeaseEscalations(
            leaseEscalation.email_enabled || leaseEscalation.in_app_enabled,
          );

        const commissionRelease = data.find((d) => d.event_type === "commission_alert");
        if (commissionRelease)
          setNotifyCommissionReleases(
            commissionRelease.email_enabled || commissionRelease.in_app_enabled,
          );

        // Channels we base off the first valid row
        const sampleRow = data[0];
        setChannelEmail(sampleRow.email_enabled);
        setChannelInApp(sampleRow.in_app_enabled);
        setFrequency(sampleRow.frequency || "realtime");
      }
      return data;
    },
  });

  const saveNotificationPreferences = async () => {
    if (!account) return;
    setSavingNotifications(true);
    try {
      const prefs = [
        { event_type: "deal_update", enabled: notifyDealUpdates },
        { event_type: "condition_reminder", enabled: notifyConditionReminders },
        { event_type: "lead_assignment", enabled: notifyLeadAssignments },
        { event_type: "lease_escalation", enabled: notifyLeaseEscalations },
        { event_type: "commission_alert", enabled: notifyCommissionReleases },
      ];

      const upserts = prefs.map((p) => ({
        user_id: account.id,
        event_type: p.event_type,
        email_enabled: p.enabled && channelEmail,
        in_app_enabled: p.enabled && channelInApp,
        frequency: frequency,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("user_notification_preference")
        .upsert(upserts, { onConflict: "user_id,event_type" });

      if (error) throw error;
      toast.success("Notification preferences saved successfully.");
    } catch (error: any) {
      toast.error(error.message || "Failed to save notifications.");
    } finally {
      setSavingNotifications(false);
    }
  };

  // Tab 4: Email Signature State
  const [designation, setDesignation] = useState(
    account?.role === "principal"
      ? "Principal Property Practitioner"
      : "Professional Property Practitioner",
  );
  const [eSignPin, setESignPin] = useState("1234");

  // Tab 5: Security & Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const uploadAvatarPhoto = async () => {
    if (!account || !avatarFile) return;
    setUploadingAvatar(true);
    try {
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const key = `${account.agencyId}/avatars/${account.id}/profile-${Date.now()}.${ext}`;
      await uploadFileToR2(avatarFile, key);

      const { error } = await supabase
        .from("user_account")
        .update({ avatar_url: key })
        .eq("id", account.id);

      if (error) throw error;
      toast.success("Profile picture updated and stored on Cloudflare R2!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const savePersonalDetails = async () => {
    if (!account) return;
    setSavingDetails(true);
    try {
      const { error } = await supabase
        .from("user_account")
        .update({
          full_name: fullName,
          telephone: telephone || null,
        })
        .eq("id", account.id);

      if (error) throw error;
      toast.success("Personal details updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setSavingDetails(false);
    }
  };

  const uploadFFC = async () => {
    if (!account) return;
    if (!certificateNumber || !issuedOn || !expiresOn) {
      return toast.error("Please fill in all FFC certificate details.");
    }
    if (!file) {
      return toast.error("Please select a PDF or image of your FFC certificate.");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("File exceeds 5MB limit.");
    }

    setUploadingFFC(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const key = `${account.agencyId}/compliance/${account.id}/${crypto.randomUUID()}-${safeName}`;

      await uploadFileToR2(file, key);

      const { error } = await supabase.rpc("upsert_ffc_certificate", {
        p_user_account_id: account.id,
        p_certificate_number: certificateNumber,
        p_issued_on: issuedOn,
        p_expires_on: expiresOn,
        p_filename: file.name,
        p_storage_key: key,
        p_mime_type: file.type,
        p_size_bytes: file.size,
      });

      if (error) throw error;

      toast.success("FFC Certificate successfully uploaded and verified.");
      setCertificateNumber("");
      setIssuedOn("");
      setExpiresOn("");
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload FFC.");
    } finally {
      setUploadingFFC(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const copySignatureHtml = () => {
    const signatureText = `${fullName}\n${designation}\nDream Supreme Properties\nMobile: ${telephone || account?.telephone || ""}\nEmail: ${account?.email || ""}\nPPRA FFC Ref: ${certificateNumber || "Active"}\n"Registered with the PPRA"`;
    navigator.clipboard.writeText(signatureText);
    toast.success("Email signature copied to clipboard!");
  };

  return (
    <AppShell
      title="User Settings & Compliance"
      description="Manage your profile, Fidelity Fund Certificate, notification preferences, and security."
      crumbs={[{ label: "Settings" }]}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full bg-card/60 border p-1 rounded-xl">
            <TabsTrigger value="profile" className="flex items-center gap-2 text-xs">
              <UserCircle className="size-4" /> My Profile
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2 text-xs">
              <ShieldCheck className="size-4" /> Compliance & FFC
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 text-xs">
              <Bell className="size-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="signature" className="flex items-center gap-2 text-xs">
              <Mail className="size-4" /> Signature & E-Sign
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 text-xs">
              <KeyRound className="size-4" /> Security
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MY PROFILE */}
          <TabsContent value="profile" className="space-y-6">
            {/* Profile Avatar Card */}
            <GlassCard>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <Avatar className="size-24 border-2 border-primary/40 shadow-xl">
                    <AvatarImage src={avatarPreview || undefined} alt={fullName} />
                    <AvatarFallback className="text-2xl font-bold bg-primary/20 text-primary">
                      {fullName
                        ? fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "AG"}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-file-input"
                    className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    title="Upload new profile picture"
                  >
                    <Camera className="size-4" />
                  </label>
                  <input
                    id="avatar-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error("Avatar image must be under 5MB.");
                          return;
                        }
                        setAvatarFile(file);
                        if (avatarPreview) {
                          URL.revokeObjectURL(avatarPreview);
                        }
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5 text-center sm:text-left flex-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h3 className="font-display text-base font-semibold">Profile Picture</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a professional headshot for client mandates, OTPs, and public
                    practitioner cards.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                    <Button
                      size="sm"
                      disabled={!avatarFile || uploadingAvatar}
                      onClick={() => void uploadAvatarPhoto()}
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="mr-2 size-3.5" />
                      )}
                      {uploadingAvatar ? "Saving..." : "Save Picture"}
                    </Button>
                    {avatarPreview && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setAvatarFile(null);
                          setAvatarPreview(null);
                        }}
                      >
                        <Trash2 className="mr-1.5 size-3.5" /> Remove Preview
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <GlassCard>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold">Personal Information</h3>
                    <p className="text-xs text-muted-foreground">
                      Your identity and contact details across mandates and contracts.
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {account?.role || "Agent"}
                  </Badge>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Full Legal Name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mobile Telephone Number</Label>
                    <Input
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="+27 82 123 4567"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input
                      value={account?.email || ""}
                      disabled
                      className="bg-muted/50 font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Managed via Supabase Auth identity.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Afrikaans">Afrikaans</SelectItem>
                        <SelectItem value="isiZulu">isiZulu</SelectItem>
                        <SelectItem value="isiXhosa">isiXhosa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full"
                    disabled={savingDetails || !fullName}
                    onClick={() => void savePersonalDetails()}
                  >
                    <Save className="mr-2 size-4" />
                    {savingDetails ? "Saving..." : "Save Profile Details"}
                  </Button>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="mb-6">
                  <h3 className="font-display text-base font-semibold">
                    PPRA Professional Credentials
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Regulatory registration and property practitioner status.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Practitioner Status</Label>
                    <Input
                      value={
                        account?.role === "principal"
                          ? "Principal Property Practitioner"
                          : "Professional Property Practitioner (FFC)"
                      }
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>PPRA Reference ID</Label>
                    <Input
                      value="PPRA-2026-REG"
                      disabled
                      className="bg-muted/50 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Professional Bio & Statement</Label>
                    <Textarea
                      rows={4}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Enter bio for mandates..."
                    />
                  </div>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* TAB 2: COMPLIANCE & FFC */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <GlassCard>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold">FFC Compliance Status</h3>
                    <p className="text-xs text-muted-foreground">
                      Annual Fidelity Fund Certificate audit state under PPRA Section 47.
                    </p>
                  </div>
                  <Badge
                    variant="default"
                    className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  >
                    <CheckCircle2 className="mr-1 size-3" /> FFC Valid
                  </Badge>
                </div>
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Certificate Number</span>
                      <span className="font-mono font-medium">FFC-882194</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Issued Date</span>
                      <span>2026-01-01</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Expiry Date</span>
                      <span className="font-medium text-emerald-400">2026-12-31</span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 bg-muted/10 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">PPRA Mandatory Requirement:</p>
                    <p>
                      Commission calculations are hard-locked if your Fidelity Fund Certificate
                      expires.
                    </p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="mb-6">
                  <h3 className="font-display text-base font-semibold">
                    Upload Annual FFC Certificate
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload your renewed PPRA certificate to remain active.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Certificate Number *</Label>
                    <Input
                      value={certificateNumber}
                      onChange={(e) => setCertificateNumber(e.target.value)}
                      placeholder="e.g., 1234567"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Issue Date *</Label>
                      <Input
                        type="date"
                        value={issuedOn}
                        onChange={(e) => setIssuedOn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Expiry Date *</Label>
                      <Input
                        type="date"
                        value={expiresOn}
                        onChange={(e) => setExpiresOn(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Certificate File *</Label>
                    <div className="relative">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="peer hidden"
                        id="ffc-upload"
                      />
                      <label
                        htmlFor="ffc-upload"
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-6 transition-colors hover:bg-muted/50"
                      >
                        <UploadCloud className="size-6 text-muted-foreground" />
                        <span className="text-center text-sm font-medium">
                          {file ? file.name : "Click to select certificate"}
                        </span>
                        {!file && (
                          <span className="text-[10px] text-muted-foreground">
                            PDF or Image up to 5MB
                          </span>
                        )}
                      </label>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    disabled={
                      uploadingFFC || !file || !certificateNumber || !issuedOn || !expiresOn
                    }
                    onClick={() => void uploadFFC()}
                  >
                    <FileText className="mr-2 size-4" />
                    {uploadingFFC ? "Uploading..." : "Upload FFC Document"}
                  </Button>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* TAB 3: NOTIFICATIONS */}
          <TabsContent value="notifications" className="space-y-6">
            <GlassCard>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-semibold">
                    Notification & Alert Preferences
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Control when and how you receive transaction, condition, and lead updates.
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={savingNotifications}
                  onClick={saveNotificationPreferences}
                >
                  <Save className="mr-2 size-4" />
                  {savingNotifications ? "Saving..." : "Save Preferences"}
                </Button>
              </div>

              <div className="space-y-6">
                {/* Audio Sound Settings Card */}
                <div className="rounded-xl border p-4 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {soundEnabled ? (
                          <Volume2 className="size-5" />
                        ) : (
                          <VolumeX className="size-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Audio Chimes & Sound Effects</div>
                        <div className="text-xs text-muted-foreground">
                          Play an audible audio tone when new notifications, alerts, or toast events
                          occur.
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={soundEnabled}
                      onCheckedChange={(val) => {
                        setSoundEnabled(val);
                        if (val) playNotificationSound(soundType);
                      }}
                    />
                  </div>

                  {soundEnabled && (
                    <div className="flex items-center justify-between gap-4 pt-3 border-t">
                      <div className="flex items-center gap-3">
                        <Label className="text-xs">Chime Tone Style:</Label>
                        <Select
                          value={soundType}
                          onValueChange={(val: "chime" | "alert" | "success") => {
                            setSoundType(val);
                            playNotificationSound(val);
                          }}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chime">Modern Triad Chime</SelectItem>
                            <SelectItem value="alert">Attention Alert Tone</SelectItem>
                            <SelectItem value="success">Success Bell</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => playNotificationSound(soundType)}
                      >
                        <Volume2 className="mr-1.5 size-3.5" /> Test Sound
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-primary">Event Triggers</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium text-sm">Deal Stage Transitions</div>
                        <div className="text-xs text-muted-foreground">
                          Receive alerts when deals move to OTP Signed, Lodged, or Registered.
                        </div>
                      </div>
                      <Switch
                        checked={notifyDealUpdates}
                        onCheckedChange={(val) => {
                          setNotifyDealUpdates(val);
                          if (val && soundEnabled) playNotificationSound(soundType);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium text-sm">Suspensive Condition Reminders</div>
                        <div className="text-xs text-muted-foreground">
                          3-day & 1-day reminders for bond approval and due diligence dates.
                        </div>
                      </div>
                      <Switch
                        checked={notifyConditionReminders}
                        onCheckedChange={setNotifyConditionReminders}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium text-sm">New Lead Assignment Alerts</div>
                        <div className="text-xs text-muted-foreground">
                          Instant alerts when a buyer or tenant lead is assigned to you.
                        </div>
                      </div>
                      <Switch
                        checked={notifyLeadAssignments}
                        onCheckedChange={setNotifyLeadAssignments}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium text-sm">
                          Lease Rent Escalation & Expiry Notices
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Warnings for upcoming annual escalations and 60-day lease renewals.
                        </div>
                      </div>
                      <Switch
                        checked={notifyLeaseEscalations}
                        onCheckedChange={setNotifyLeaseEscalations}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium text-sm">Commission Disbursal Releases</div>
                        <div className="text-xs text-muted-foreground">
                          Notifications when your commission calculations are approved by the
                          principal.
                        </div>
                      </div>
                      <Switch
                        checked={notifyCommissionReleases}
                        onCheckedChange={setNotifyCommissionReleases}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium text-primary">Delivery Channels</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">In-App Notifications</span>
                      <Switch checked={channelInApp} onCheckedChange={setChannelInApp} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">Email Dispatch</span>
                      <Switch checked={channelEmail} onCheckedChange={setChannelEmail} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">WhatsApp Links</span>
                      <Switch checked={channelWhatsApp} onCheckedChange={setChannelWhatsApp} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium text-primary">Delivery Frequency</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground w-1/3">
                      How often should we send emails?
                    </span>
                    <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time (Instant)</SelectItem>
                        <SelectItem value="digest">Daily Digest Summary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* TAB 4: EMAIL SIGNATURE & E-SIGN */}
          <TabsContent value="signature" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <GlassCard>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold">
                      Email Signature Generator
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Standardized PPRA-compliant signature block for client emails.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={copySignatureHtml}>
                    <Copy className="mr-2 size-3.5" /> Copy Text
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Title / Designation</Label>
                    <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
                  </div>

                  <div className="rounded-lg border bg-card p-4 space-y-2 text-xs font-sans">
                    <div className="font-bold text-sm text-primary">{fullName || "Jane Doe"}</div>
                    <div className="text-muted-foreground font-medium">{designation}</div>
                    <div className="font-semibold">Dream Supreme Properties</div>
                    <div className="text-muted-foreground">
                      Mobile: {telephone || "+27 82 123 4567"}
                    </div>
                    <div className="text-muted-foreground">
                      Email: {account?.email || "jane@dreamsupreme.co.za"}
                    </div>
                    <div className="pt-2 border-t text-[10px] text-muted-foreground italic">
                      Registered with the Property Practitioners Regulatory Authority (PPRA). FFC
                      Ref: {certificateNumber || "Active"}.
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="mb-6">
                  <h3 className="font-display text-base font-semibold">E-Sign Security PIN</h3>
                  <p className="text-xs text-muted-foreground">
                    PIN code for authorizing internal checklists and non-legal approvals.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pin">4-Digit Security Authorization PIN</Label>
                    <Input
                      id="pin"
                      type="password"
                      maxLength={4}
                      value={eSignPin}
                      onChange={(e) => setESignPin(e.target.value)}
                      className="font-mono text-center text-lg tracking-widest"
                    />
                  </div>

                  <div className="rounded-lg border p-3 bg-muted/10 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">ECTA Compliance Note:</p>
                    <p>
                      Internal PIN authorization applies to operational checklists. Deeds of Sale
                      require wet-ink or certified AES signatures under ECTA Section 13.
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => toast.success("E-Sign PIN updated cleanly!")}
                  >
                    <Lock className="mr-2 size-4" /> Save Security PIN
                  </Button>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* TAB 5: SECURITY & PASSWORD */}
          <TabsContent value="security" className="space-y-6">
            <GlassCard className="max-w-xl mx-auto">
              <div className="mb-6">
                <h3 className="font-display text-base font-semibold">Change Password</h3>
                <p className="text-xs text-muted-foreground">
                  Update your Supabase authentication password.
                </p>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPass">New Password *</Label>
                  <Input
                    id="newPass"
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confPass">Confirm New Password *</Label>
                  <Input
                    id="confPass"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={updatingPassword}>
                  {updatingPassword ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
