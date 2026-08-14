import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  uploadFileToR2,
  removeStoredFile,
  getUserStorageUsage,
  recordStorageUsageDelta,
} from "@/lib/storage";

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
      const { usedBytes, limitBytes } = await getUserStorageUsage(userAccount.id);
      const storageKey = await uploadFileToR2(file, path, {
        currentStorageUsedBytes: usedBytes,
        storageLimitBytes: limitBytes,
      });
      await recordStorageUsageDelta(userAccount.id, file.size);

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
        // Cleanup storage and quota usage on db failure
        await removeStoredFile(storageKey);
        await recordStorageUsageDelta(userAccount.id, -file.size);
        throw error;
      }

      // 4. Log audit event
      await supabase.rpc("log_audit_event", {
        p_entity_type: "document",
        p_entity_id: data.id,
        p_action: "Uploaded document",
        p_summary: `Uploaded ${file.name} to category ${category}`,
        p_after_json: data,
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents", "deal", variables.dealId] });
    },
  });
}

export interface UserComplianceDocumentRecord {
  id: string;
  category: string;
  filename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByName: string;
}

export interface UserComplianceData {
  documents: UserComplianceDocumentRecord[];
  ffc: {
    id: string;
    certificateNumber: string;
    issuedOn: string;
    expiresOn: string;
    documentId?: string;
  } | null;
  ppraReference?: string;
}

export function useUserComplianceDocuments(userId?: string) {
  return useQuery<UserComplianceData>({
    queryKey: ["user-compliance-documents", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [docsResult, ffcResult, userResult] = await Promise.all([
        supabase
          .from("document")
          .select(
            `
            id,
            category,
            filename,
            storage_key,
            mime_type,
            size_bytes,
            uploaded_at,
            uploader:uploaded_by(full_name)
          `,
          )
          .eq("user_account_id", userId!)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("ffc_certificate")
          .select("id, certificate_number, issued_on, expires_on, document_id")
          .eq("user_account_id", userId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("user_account").select("ppra_reference").eq("id", userId!).maybeSingle(),
      ]);

      if (docsResult.error) throw docsResult.error;

      const documents: UserComplianceDocumentRecord[] = (docsResult.data || []).map((doc: any) => ({
        id: doc.id,
        category: doc.category,
        filename: doc.filename,
        storageKey: doc.storage_key,
        mimeType: doc.mime_type,
        sizeBytes: doc.size_bytes,
        uploadedAt: doc.uploaded_at,
        uploadedByName: doc.uploader?.full_name || "Self",
      }));

      const ffc = ffcResult.data
        ? {
            id: ffcResult.data.id,
            certificateNumber: ffcResult.data.certificate_number,
            issuedOn: ffcResult.data.issued_on,
            expiresOn: ffcResult.data.expires_on,
            documentId: ffcResult.data.document_id,
          }
        : null;

      return {
        documents,
        ffc,
        ppraReference: userResult.data?.ppra_reference || "",
      };
    },
  });
}

export function useUploadUserComplianceDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      userId,
      agencyId,
      category,
      ffcDetails,
      ppraReference,
    }: {
      file: File;
      userId: string;
      agencyId: string;
      category: string;
      ffcDetails?: {
        certificateNumber: string;
        issuedOn: string;
        expiresOn: string;
      };
      ppraReference?: string;
    }) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${agencyId}/users/${userId}/${category}/${crypto.randomUUID()}-${safeName}`;

      const { usedBytes, limitBytes } = await getUserStorageUsage(userId);
      const storageKey = await uploadFileToR2(file, path, {
        currentStorageUsedBytes: usedBytes,
        storageLimitBytes: limitBytes,
      });
      await recordStorageUsageDelta(userId, file.size);

      try {
        const { data: docData, error: docErr } = await supabase
          .from("document")
          .insert({
            agency_id: agencyId,
            user_account_id: userId,
            category: category.toLowerCase().replace(/ /g, "_"),
            filename: file.name,
            storage_key: storageKey,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by: userId,
          })
          .select()
          .single();

        if (docErr) throw docErr;

        if (ffcDetails && (category === "ffc_certificate" || category === "ffc")) {
          // Update or insert FFC certificate
          const { data: existingFfc } = await supabase
            .from("ffc_certificate")
            .select("id")
            .eq("user_account_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingFfc?.id) {
            await supabase
              .from("ffc_certificate")
              .update({
                certificate_number: ffcDetails.certificateNumber.trim(),
                issued_on: ffcDetails.issuedOn,
                expires_on: ffcDetails.expiresOn,
                document_id: docData.id,
              })
              .eq("id", existingFfc.id);
          } else {
            await supabase.from("ffc_certificate").insert({
              user_account_id: userId,
              certificate_number: ffcDetails.certificateNumber.trim(),
              issued_on: ffcDetails.issuedOn,
              expires_on: ffcDetails.expiresOn,
              document_id: docData.id,
            });
          }
        }

        if (ppraReference !== undefined) {
          await supabase
            .from("user_account")
            .update({ ppra_reference: ppraReference.trim() || null })
            .eq("id", userId);
        }

        await supabase.rpc("log_audit_event", {
          p_entity_type: "user_document",
          p_entity_id: docData.id,
          p_action: "Uploaded compliance document",
          p_summary: `Uploaded ${file.name} for compliance category ${category}`,
          p_after_json: { category, filename: file.name, sizeBytes: file.size },
        });

        return docData;
      } catch (err) {
        await removeStoredFile(storageKey).catch(() => undefined);
        await recordStorageUsageDelta(userId, -file.size).catch(() => undefined);
        throw err;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user-compliance-documents", variables.userId],
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useDeleteUserComplianceDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      storageKey,
      sizeBytes,
      userId,
    }: {
      documentId: string;
      storageKey: string;
      sizeBytes: number;
      userId: string;
    }) => {
      // 1. Delete document record
      const { error } = await supabase.from("document").delete().eq("id", documentId);
      if (error) throw error;

      // 2. Remove file from storage & update quota
      if (storageKey) {
        await removeStoredFile(storageKey).catch(() => undefined);
      }
      if (sizeBytes > 0) {
        await recordStorageUsageDelta(userId, -sizeBytes).catch(() => undefined);
      }

      // 3. Clear ffc_certificate document_id link if this was linked
      await supabase
        .from("ffc_certificate")
        .update({ document_id: null })
        .eq("document_id", documentId);

      await supabase.rpc("log_audit_event", {
        p_entity_type: "user_document",
        p_entity_id: documentId,
        p_action: "Deleted compliance document",
        p_summary: `Removed compliance document ${documentId}`,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user-compliance-documents", variables.userId],
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
