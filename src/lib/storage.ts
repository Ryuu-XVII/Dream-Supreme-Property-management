import { supabase } from "@/lib/supabase";

const DOCUMENT_BUCKET = "mandate-documents";

/**
 * Browser-safe storage adapter. The browser receives only a Supabase session;
 * object-store credentials are never bundled into client JavaScript.
 *
 * The historic function name is retained to avoid breaking callers while the
 * backing implementation uses the private Supabase bucket configured by the
 * database migration. R2 can be introduced behind a server-side adapter later.
 */
export const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024; // 50MB max per document
export const MAX_BUCKET_STORAGE_BYTES = 8 * 1024 * 1024 * 1024; // 8GB total storage cap

export async function uploadFileToR2(file: File | Blob, path: string): Promise<string> {
  if (file.size > MAX_SINGLE_FILE_BYTES) {
    throw new Error(
      `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowable limit of 50MB per file to maintain 8GB storage ceiling.`,
    );
  }

  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return data.path;
}

export async function getR2FileUrl(key: string | null | undefined): Promise<string> {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(key, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeStoredFile(key: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([key]);
  if (error) throw error;
}
