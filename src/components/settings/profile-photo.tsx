import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  getUserStorageUsage,
  recordStorageUsageDelta,
  removeStoredFile,
  uploadFileToR2,
} from "@/lib/storage";

// Profile photos are displayed at 80px, so there is no reason to accept a
// multi-megabyte original. Kept well under MAX_SINGLE_FILE_BYTES.
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function ProfilePhoto() {
  const { account, user, refreshAccount, isReadOnly } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const avatarKey = account?.avatarKey ?? null;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file || !account || !user) return;

    if (isReadOnly) {
      toast.info("Read-only mode: exit impersonation to change the photo.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(`Photo is ${(file.size / (1024 * 1024)).toFixed(1)}MB — the maximum is 5MB.`);
      return;
    }

    setBusy(true);
    const previousKey = avatarKey;
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const { usedBytes, limitBytes } = await getUserStorageUsage(account.id);
      const storageKey = await uploadFileToR2(
        file,
        `${account.agencyId}/avatars/${user.id}/${crypto.randomUUID()}.${ext}`,
        { currentStorageUsedBytes: usedBytes, storageLimitBytes: limitBytes },
      );

      // The size of the photo being replaced, read just before overwriting
      // avatar_key, so it can be released from the quota below -- there is
      // no other record of it once the row points at the new key.
      const { data: previousRow } = await supabase
        .from("user_account")
        .select("avatar_size_bytes")
        .eq("id", account.id)
        .maybeSingle();
      const previousSize = previousKey ? (previousRow?.avatar_size_bytes ?? 0) : 0;

      const { error } = await supabase
        .from("user_account")
        .update({ avatar_key: storageKey, avatar_size_bytes: file.size })
        .eq("id", account.id);
      if (error) {
        // Don't leave an orphaned object behind if the profile row rejected it.
        await removeStoredFile(storageKey).catch(() => undefined);
        throw error;
      }
      await recordStorageUsageDelta(account.id, file.size - previousSize);

      // The old photo is unreachable once the row points at the new key, so
      // remove it rather than silently consuming the agent's quota forever.
      if (previousKey) {
        await removeStoredFile(previousKey).catch(() => undefined);
      }

      await refreshAccount();
      await queryClient.invalidateQueries({ queryKey: ["avatar-url"] });
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error(`Failed to upload photo: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!account || !avatarKey) return;
    if (isReadOnly) {
      toast.info("Read-only mode: exit impersonation to change the photo.");
      return;
    }

    setBusy(true);
    try {
      const { data: currentRow } = await supabase
        .from("user_account")
        .select("avatar_size_bytes")
        .eq("id", account.id)
        .maybeSingle();

      const { error } = await supabase
        .from("user_account")
        .update({ avatar_key: null, avatar_size_bytes: null })
        .eq("id", account.id);
      if (error) throw error;

      if (currentRow?.avatar_size_bytes) {
        await recordStorageUsageDelta(account.id, -currentRow.avatar_size_bytes);
      }
      await removeStoredFile(avatarKey).catch(() => undefined);
      await refreshAccount();
      await queryClient.invalidateQueries({ queryKey: ["avatar-url"] });
      toast.success("Profile photo removed");
    } catch (err: any) {
      toast.error(`Failed to remove photo: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    // Full-width banner rather than a grid cell: as a single-column card it was
    // stretched to the height of the much taller form beside it, leaving a large
    // block of empty space under the avatar.
    <GlassCard className="lg:col-span-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <UserAvatar
          avatarKey={avatarKey}
          name={account?.fullName ?? "?"}
          className="size-16 shrink-0"
          fallbackClassName="bg-primary text-lg text-primary-foreground"
        />
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Camera className="size-4 text-primary" /> Profile photo
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Shown next to your name across the platform. JPEG or PNG, up to 5MB.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || isReadOnly}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Working…" : avatarKey ? "Change photo" : "Upload photo"}
          </Button>
          {avatarKey && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={busy || isReadOnly}
              onClick={removePhoto}
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        // Must match ALLOWED_DOCUMENT_MIME_TYPES in src/lib/storage.ts.
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFile}
      />
    </GlassCard>
  );
}
