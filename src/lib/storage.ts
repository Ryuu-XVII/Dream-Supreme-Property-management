import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
}

function getR2Credentials() {
  const r2AccountId =
    (typeof process !== "undefined"
      ? process.env?.VITE_R2_ACCOUNT_ID || process.env?.CLOUDFLARE_R2_ACCOUNT_ID
      : undefined) ||
    import.meta.env?.VITE_R2_ACCOUNT_ID ||
    import.meta.env?.CLOUDFLARE_R2_ACCOUNT_ID;

  const r2AccessKeyId =
    (typeof process !== "undefined"
      ? process.env?.VITE_R2_ACCESS_KEY_ID || process.env?.CLOUDFLARE_R2_ACCESS_KEY_ID
      : undefined) ||
    import.meta.env?.VITE_R2_ACCESS_KEY_ID ||
    import.meta.env?.CLOUDFLARE_R2_ACCESS_KEY_ID;

  const r2SecretAccessKey =
    (typeof process !== "undefined"
      ? process.env?.VITE_R2_SECRET_ACCESS_KEY || process.env?.CLOUDFLARE_R2_SECRET_ACCESS_KEY
      : undefined) ||
    import.meta.env?.VITE_R2_SECRET_ACCESS_KEY ||
    import.meta.env?.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  return { r2AccountId, r2AccessKeyId, r2SecretAccessKey };
}

export const R2_BUCKET_NAME =
  (typeof process !== "undefined"
    ? process.env?.VITE_R2_BUCKET_NAME || process.env?.CLOUDFLARE_R2_BUCKET_NAME
    : undefined) ||
  import.meta.env?.VITE_R2_BUCKET_NAME ||
  import.meta.env?.CLOUDFLARE_R2_BUCKET_NAME ||
  "dream-supreme-documents";

export const R2_PUBLIC_URL =
  (typeof process !== "undefined"
    ? process.env?.VITE_R2_PUBLIC_URL || process.env?.CLOUDFLARE_R2_PUBLIC_URL
    : undefined) ||
  import.meta.env?.VITE_R2_PUBLIC_URL ||
  import.meta.env?.CLOUDFLARE_R2_PUBLIC_URL;

let s3Client: S3Client | null = null;
let currentAccountId: string | undefined = undefined;

export function getR2Client(): S3Client | null {
  const { r2AccountId, r2AccessKeyId, r2SecretAccessKey } = getR2Credentials();

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    s3Client = null;
    currentAccountId = undefined;
    return null;
  }

  if (!s3Client || currentAccountId !== r2AccountId) {
    currentAccountId = r2AccountId;
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });
  }

  return s3Client;
}

/**
 * Upload a file/blob to Cloudflare R2 object storage (or fallback to Supabase Storage)
 * with per-user quota checking.
 */
export async function uploadFileToR2(
  file: File | Blob,
  path: string,
  quotaOptions?: StorageQuotaOptions,
): Promise<string> {
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

  const client = getR2Client();

  if (client) {
    const arrayBuffer = await file.arrayBuffer();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: path,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type || "application/octet-stream",
    });
    await client.send(command);
    return path;
  }

  // Fallback to Supabase Storage if R2 is not configured
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return data.path;
}

/**
 * Get a presigned download URL (or public URL) for a file stored in Cloudflare R2 / Supabase Storage.
 */
export async function getR2FileUrl(key: string | null | undefined): Promise<string> {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;

  const client = getR2Client();

  if (client) {
    if (R2_PUBLIC_URL) {
      const baseUrl = R2_PUBLIC_URL.endsWith("/") ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL;
      const cleanKey = key.startsWith("/") ? key.slice(1) : key;
      return `${baseUrl}/${cleanKey}`;
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn: 300 });
  }

  // Fallback to Supabase Storage
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(key, 300);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete a file from Cloudflare R2 storage / Supabase Storage.
 */
export async function removeStoredFile(key: string): Promise<void> {
  const client = getR2Client();

  if (client) {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await client.send(command);
    return;
  }

  // Fallback to Supabase Storage
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([key]);
  if (error) throw error;
}
