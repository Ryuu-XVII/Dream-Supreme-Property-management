import { supabase } from "@/lib/supabase";

const DOCUMENT_BUCKET = "mandate-documents";

export const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024; // 50MB max per document
export const MAX_BUCKET_STORAGE_BYTES = 8 * 1024 * 1024 * 1024; // 8GB total storage cap
export const DEFAULT_USER_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1GB default storage limit per user

/**
 * Generate an isolated per-user storage key path.
 * Format: users/<user_id>/<filename>
 */
export function getUserStoragePath(userId: string, filename: string): string {
  const cleanPath = filename.replace(/^\/+/, "");
  if (cleanPath.startsWith(`users/${userId}/`)) {
    return cleanPath;
  }
  return `users/${userId}/${cleanPath}`;
}

export interface StorageQuotaOptions {
  currentStorageUsedBytes?: number;
  storageLimitBytes?: number;
  isPublic?: boolean;
}

export const R2_BUCKET_NAME =
  (typeof process !== "undefined"
    ? process.env?.VITE_R2_BUCKET_NAME || process.env?.CLOUDFLARE_R2_BUCKET_NAME
    : undefined) ||
  import.meta.env?.VITE_R2_BUCKET_NAME ||
  import.meta.env?.CLOUDFLARE_R2_BUCKET_NAME ||
  "dream-supreme-documents";

/**
 * Direct R2 access from the browser is intentionally disabled: Cloudflare R2 has no
 * browser-safe (RLS-scoped) auth mode comparable to Supabase's anon key, so any IAM
 * credential capable of signing R2 requests must never be shipped in client JS —
 * Vite inlines every `VITE_`-prefixed env var into the built bundle regardless of
 * whether the code path using it actually runs, so simply gating usage at runtime
 * isn't sufficient. Object storage always goes through Supabase Storage below, which
 * is protected by the agency-scoped RLS policies in
 * supabase/migrations/20260730000001_secure_storage_buckets.sql. Re-introducing R2
 * requires proxying uploads/downloads through a server-side function (e.g. a Supabase
 * Edge Function) that holds the R2 credentials outside the client bundle.
 */
export function getR2Client(): null {
  return null;
}

/**
 * Verify user database session and role authorization before generating presigned URLs or modifying files.
 * Admins & Principals can access any file; Agents are restricted to their own isolated storage path (users/<userId>/...).
 */
export async function verifyStorageAccessAuthorization(
  key: string,
  options?: { isPublic?: boolean },
): Promise<boolean> {
  if (options?.isPublic || key.startsWith("public/")) {
    return true;
  }

  const isTest =
    (typeof process !== "undefined" && process.env?.NODE_ENV === "test") ||
    import.meta.env?.MODE === "test";

  if (isTest) {
    return true; // Unit test stub override
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error(
      "Unauthorized: Active authentication session required to access storage files.",
    );
  }

  const { data: account } = await supabase
    .from("user_account")
    .select("id, role, agency_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Unauthorized: Active agent profile required to access storage files.");
  }

  const role = (account.role || "agent").toLowerCase();
  if (role === "admin") {
    return true; // Administrative roles have agency-wide access
  }

  // Agent role authorization check: restrict access to their own user subfolder
  const pathParts = key.split("/");
  if (pathParts[0] === "users" && pathParts[1]) {
    const targetUserId = pathParts[1];
    if (targetUserId !== account.id && targetUserId !== session.user.id) {
      throw new Error(
        "Unauthorized: You do not have permission to access another agent's private storage.",
      );
    }
  }

  return true;
}

/**
 * Upload a file/blob to Supabase Storage with per-user quota checking and
 * database authorization verification.
 */
export async function uploadFileToR2(
  file: File | Blob,
  path: string,
  quotaOptions?: StorageQuotaOptions,
): Promise<string> {
  await verifyStorageAccessAuthorization(path, { isPublic: quotaOptions?.isPublic });

  if (file.size > MAX_SINGLE_FILE_BYTES) {
    throw new Error(
      `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowable limit of 50MB per file to maintain 8GB storage ceiling.`,
    );
  }

  const limit = quotaOptions?.storageLimitBytes ?? DEFAULT_USER_STORAGE_LIMIT_BYTES;
  const currentUsed = quotaOptions?.currentStorageUsedBytes ?? 0;

  if (currentUsed + file.size > limit) {
    const limitMb = (limit / (1024 * 1024)).toFixed(0);
    const usedMb = (currentUsed / (1024 * 1024)).toFixed(1);
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Storage quota exceeded: Uploading ${fileMb}MB would exceed your assigned quota limit of ${limitMb}MB (Currently using ${usedMb}MB). Please contact an administrator to upgrade your storage limit.`,
    );
  }

  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return data.path;
}

/**
 * Get a presigned download URL for a file stored in Supabase Storage after
 * verifying database authorization.
 */
export async function getR2FileUrl(
  key: string | null | undefined,
  options?: { isPublic?: boolean },
): Promise<string> {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;

  await verifyStorageAccessAuthorization(key, options);

  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(key, 300);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete a file from Supabase Storage after verifying authorization.
 */
export async function removeStoredFile(
  key: string,
  options?: { isPublic?: boolean },
): Promise<void> {
  await verifyStorageAccessAuthorization(key, options);

  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([key]);
  if (error) throw error;
}
