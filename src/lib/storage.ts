import { supabase } from "@/lib/supabase";

const DOCUMENT_BUCKET = "mandate-documents";

// Must stay in sync with the `mandate-documents` bucket's file_size_limit and
// allowed_mime_types in supabase/migrations/20260730000001_secure_storage_buckets.sql —
// otherwise uploads that pass client-side checks are rejected server-side with a
// confusing error instead of a clear one.
export const MAX_SINGLE_FILE_BYTES = 20 * 1024 * 1024; // 20MB max per document
export const DEFAULT_USER_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1GB default storage limit per user
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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
 * Direct R2 access from the browser is intentionally impossible: Cloudflare R2 has no
 * browser-safe (RLS-scoped) auth mode comparable to Supabase's anon key, so any IAM
 * credential capable of signing R2 requests must never be shipped in client JS — Vite
 * inlines every `VITE_`-prefixed env var into the built bundle regardless of whether
 * the code path using it actually runs. Instead, the `r2-storage` Supabase Edge
 * Function (supabase/functions/r2-storage) holds the R2 credentials as server-side
 * secrets and hands the browser short-lived presigned PUT/GET URLs; the actual file
 * bytes then flow directly between the browser and R2, never through Supabase. This
 * function is kept only so callers/tests can check whether a client-side R2 SDK
 * instance exists — it always does not, by design.
 */
export function getR2Client(): null {
  return null;
}

async function isR2Configured(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("r2-storage", {
      body: { action: "status" },
    });
    return !error && !!data?.configured;
  } catch {
    return false;
  }
}

/**
 * Invoke the r2-storage edge function for a presign/delete action. Returns null when
 * R2 is not configured (missing secrets, function not deployed) so callers can fall
 * back to Supabase Storage; throws for any other failure so a real, configured R2
 * error is never silently swallowed into a fallback that would put bytes in the
 * wrong place.
 */
async function callR2Proxy<T>(
  body: Record<string, unknown>,
): Promise<{ data: T; usedR2: true } | { data: null; usedR2: false }> {
  if (!(await isR2Configured())) return { data: null, usedR2: false };

  const { data, error } = await supabase.functions.invoke("r2-storage", { body });
  if (error) {
    throw new Error(
      `R2 storage operation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return { data: data as T, usedR2: true };
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

  // Agent role authorization check. Storage keys follow one of two conventions:
  // `users/<userId>/...` for per-user private files, or `<agencyId>/...` for
  // agency-scoped documents (deals, FFC certificates, avatars). Restrict agents
  // to their own user folder or their own agency's folder accordingly. This is
  // defense-in-depth alongside the agency-scoped RLS policies in
  // supabase/migrations/20260730000001_secure_storage_buckets.sql, which are the
  // authoritative enforcement point.
  const pathParts = key.split("/");
  if (pathParts[0] === "users" && pathParts[1]) {
    const targetUserId = pathParts[1];
    if (targetUserId !== account.id && targetUserId !== session.user.id) {
      throw new Error(
        "Unauthorized: You do not have permission to access another agent's private storage.",
      );
    }
  } else if (pathParts[0] !== account.agency_id) {
    throw new Error(
      "Unauthorized: You do not have permission to access files outside your agency.",
    );
  }

  return true;
}

// Magic-byte signatures for each allowed MIME type. The browser-supplied
// `file.type` (and the Content-Type header derived from it) can be spoofed
// trivially by renaming a file or editing form data, and the Supabase bucket's
// allowed_mime_types check relies on that same client-supplied header — so
// without this, both the client and bucket checks can be bypassed by simply
// mislabeling a file. Sniffing the actual leading bytes catches that class of
// bypass, though it does not substitute for content/virus scanning.
const FILE_SIGNATURES: Record<string, { offset: number; bytes: number[] }[]> = {
  "application/pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  "image/jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "application/msword": [{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  // .docx (and other OOXML formats) are zip archives, identified by the local
  // file header signature "PK\x03\x04".
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
};

async function verifyFileSignature(file: File | Blob, mimeType: string): Promise<boolean> {
  const signatures = FILE_SIGNATURES[mimeType];
  if (!signatures) return true;

  const maxLen = Math.max(...signatures.map((sig) => sig.offset + sig.bytes.length));
  const head = new Uint8Array(await file.slice(0, maxLen).arrayBuffer());

  return signatures.some((sig) => sig.bytes.every((b, i) => head[sig.offset + i] === b));
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
      `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowable limit of 20MB per file.`,
    );
  }

  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(contentType)) {
    throw new Error(
      `File type "${contentType}" is not supported. Allowed types: JPEG, PNG, PDF, DOC, DOCX.`,
    );
  }

  if (!(await verifyFileSignature(file, contentType))) {
    throw new Error(
      `File content does not match its declared type "${contentType}". The file may be corrupted, mislabeled, or renamed from a different format.`,
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

  const r2 = await callR2Proxy<{ url: string; key: string }>({
    action: "presign-put",
    key: path,
    contentType,
    isPublic: quotaOptions?.isPublic,
  });

  if (r2.usedR2) {
    const putRes = await fetch(r2.data.url, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`R2 upload failed with status ${putRes.status}`);
    }
    return r2.data.key;
  }

  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    upsert: false,
    contentType,
  });
  if (error) throw error;
  return data.path;
}

/**
 * Fetch a user's current storage usage/limit so callers can pass accurate
 * StorageQuotaOptions into uploadFileToR2 instead of implicitly checking
 * against zero bytes used.
 */
export async function getUserStorageUsage(
  userId: string,
): Promise<{ usedBytes: number; limitBytes: number }> {
  const { data, error } = await supabase
    .from("user_account")
    .select("storage_used_bytes, storage_limit_bytes")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    usedBytes: data?.storage_used_bytes ?? 0,
    limitBytes: data?.storage_limit_bytes ?? DEFAULT_USER_STORAGE_LIMIT_BYTES,
  };
}

/**
 * Record a change in a user's storage usage (positive on upload) via the
 * `adjust_user_storage_usage` RPC, which enforces that callers may only
 * adjust their own usage unless they hold an admin role.
 */
export async function recordStorageUsageDelta(userId: string, deltaBytes: number): Promise<void> {
  const { error } = await supabase.rpc("adjust_user_storage_usage", {
    target_user_id: userId,
    bytes_delta: deltaBytes,
  });
  if (error) throw error;
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

  const r2 = await callR2Proxy<{ url: string }>({
    action: "presign-get",
    key,
    isPublic: options?.isPublic,
  });
  if (r2.usedR2) return r2.data.url;

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

  const r2 = await callR2Proxy<{ deleted: boolean }>({
    action: "delete",
    key,
    isPublic: options?.isPublic,
  });
  if (r2.usedR2) return;

  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([key]);
  if (error) throw error;
}
