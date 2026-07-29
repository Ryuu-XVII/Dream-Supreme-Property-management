import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const accountId = import.meta.env.VITE_R2_ACCOUNT_ID || "";
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID || "";
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || "";
export const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME || "dream-supreme-storage";
export const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Upload a file to Cloudflare R2 bucket.
 * returns the key of the uploaded object.
 */
export async function uploadFileToR2(file: File | Blob, path: string): Promise<string> {
  if (!accessKeyId || !secretAccessKey || !accountId) {
    console.warn("Cloudflare R2 credentials missing in .env. Skipping actual upload.");
    return `mock_r2_key_${Date.now()}_${path.split("/").pop()}`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: path,
    Body: buffer,
    ContentType: file.type || "application/octet-stream",
  });

  await r2Client.send(command);
  return path;
}

/**
 * Returns a public URL or custom CDN URL for a file stored in Cloudflare R2.
 */
export function getR2FileUrl(key: string | null | undefined): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  return `https://${R2_BUCKET_NAME}.${accountId}.r2.cloudflarestorage.com/${key}`;
}
