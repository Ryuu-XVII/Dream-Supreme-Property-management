import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadFileToR2, removeStoredFile } from "@/lib/storage";

export interface DocumentRecord {
  id: string;
  category: string;
  filename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  supersedesId?: string;
  uploadedBy: string; // name
  uploadedAt: string;
}

export function useDocuments(dealId?: string) {
  return useQuery({
    queryKey: ["documents", "deal", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document")
        .select(
          `
          id,
          category,
          filename,
          storage_key,
          mime_type,
          size_bytes,
          version,
          supersedes_id,
          uploaded_at,
          uploader:uploaded_by(full_name)
        `,
        )
        .eq("deal_id", dealId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((doc: any) => ({
        id: doc.id,
        category: doc.category,
        name: doc.filename, // Using name for UI compatibility
        storageKey: doc.storage_key,
        mimeType: doc.mime_type,
        sizeBytes: doc.size_bytes,
        sizeKb: Math.round((doc.size_bytes || 0) / 1024),
        version: doc.version,
        supersedes: doc.supersedes_id,
        uploadedBy: doc.uploader?.full_name || "Unknown",
        uploadedAt: doc.uploaded_at,
      }));
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      dealId,
      category,
      agencyId,
      supersedesId,
      currentVersion = 0,
    }: {
      file: File;
      dealId: string;
      category: string;
      agencyId: string;
      supersedesId?: string;
      currentVersion?: number;
    }) => {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userAccount } = await supabase
        .from("user_account")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!userAccount) throw new Error("User account not found");

      // 2. Upload file to storage
      const path = `${agencyId}/${dealId}/${crypto.randomUUID()}-${file.name}`;
      const storageKey = await uploadFileToR2(file, path);

      // 3. Insert into database
      const { data, error } = await supabase
        .from("document")
        .insert({
          agency_id: agencyId,
          deal_id: dealId,
          category: category.toLowerCase().replace(/ /g, "_"), // Map to enum if needed, or backend might handle it
          filename: file.name,
          storage_key: storageKey,
          mime_type: file.type,
          size_bytes: file.size,
          version: currentVersion + 1,
          supersedes_id: supersedesId,
          uploaded_by: userAccount.id,
        })
        .select()
        .single();

      if (error) {
        // Cleanup storage on db failure
        await removeStoredFile(storageKey);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents", "deal", variables.dealId] });
    },
  });
}
