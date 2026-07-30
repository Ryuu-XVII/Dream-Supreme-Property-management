import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { uploadFileToR2 } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, UploadCloud, Save } from "lucide-react";

export const Route = createFileRoute("/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { account } = useAuth();

  // Personal Details State
  const [fullName, setFullName] = useState(account?.fullName || "");
  const [telephone, setTelephone] = useState(account?.telephone || "");
  const [savingDetails, setSavingDetails] = useState(false);

  // FFC Upload State
  const [certificateNumber, setCertificateNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadingFFC, setUploadingFFC] = useState(false);

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
      toast.success("Profile details updated.");
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

  return (
    <AppShell
      title="My Profile"
      description="Manage your personal details and compliance certificates."
      crumbs={[{ label: "Settings", to: "/settings/agency" }, { label: "Profile" }]}
    >
      <SettingsTabs />

      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        {/* Personal Details */}
        <GlassCard className="h-fit">
          <div className="mb-6">
            <h3 className="font-display text-base font-semibold">Personal Details</h3>
            <p className="text-xs text-muted-foreground">
              Update your contact information for deals and mandates.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telephone Number</Label>
              <Input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+27 82 123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input value={account?.email || ""} disabled className="bg-muted/50" />
              <p className="text-[10px] text-muted-foreground">Email address cannot be changed.</p>
            </div>
            <Button
              className="w-full"
              disabled={savingDetails || !fullName}
              onClick={() => void savePersonalDetails()}
            >
              <Save className="mr-2 size-4" />
              {savingDetails ? "Saving..." : "Save details"}
            </Button>
          </div>
        </GlassCard>

        {/* FFC Upload */}
        <GlassCard className="h-fit">
          <div className="mb-6">
            <h3 className="font-display text-base font-semibold">Fidelity Fund Certificate</h3>
            <p className="text-xs text-muted-foreground">
              Upload your annual PPRA certificate to remain active on the platform.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Certificate Number</Label>
              <Input
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="e.g., 1234567"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Issue Date</Label>
                <Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Certificate File</Label>
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
              disabled={uploadingFFC || !file || !certificateNumber || !issuedOn || !expiresOn}
              onClick={() => void uploadFFC()}
            >
              <FileText className="mr-2 size-4" />
              {uploadingFFC ? "Uploading..." : "Upload FFC"}
            </Button>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
