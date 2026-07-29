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
export async function uploadFileToR2(file: File | Blob, path: string): Promise<string> {
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
