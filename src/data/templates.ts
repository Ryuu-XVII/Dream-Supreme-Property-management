import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { DocumentTemplate } from "@/types";

export function useDocumentTemplates() {
  const { account } = useAuth();

  return useQuery({
    queryKey: ["document-templates", account?.agencyId],
    enabled: !!account,
    queryFn: async (): Promise<DocumentTemplate[]> => {
      const { data, error } = await supabase
        .from("document_template")
        .select("*")
        .eq("agency_id", account!.agencyId)
        .order("name", { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        agencyId: row.agency_id,
        name: row.name,
        category: row.category,
        bodyMarkdown: row.body_markdown,
        version: row.version,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
  });
}

export function parseTemplateMerge(
  templateBody: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  let result = templateBody;
  Object.entries(variables).forEach(([key, val]) => {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(placeholder, val !== undefined && val !== null ? String(val) : "");
  });
  return result;
}

export function useGenerateDocumentFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { templateId: string; dealId?: string; leaseId?: string }) => {
      const { data, error } = await supabase.rpc("generate_document_from_template", {
        p_template_id: payload.templateId,
        p_deal_id: payload.dealId || null,
        p_lease_id: payload.leaseId || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
