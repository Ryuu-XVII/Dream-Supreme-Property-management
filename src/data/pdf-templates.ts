import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Template } from "@pdfme/common";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getPdfDocumentType, type PdfDocumentTypeDef } from "@/lib/pdf-document-types";
import {
  buildCertificateTemplate,
  buildLegalTemplate,
  buildReportTemplate,
} from "@/lib/pdf-template-layouts";

export interface PdfTemplateRow {
  id: string;
  documentType: string;
  name: string;
  template: Template;
  updatedAt: string;
}

// A fully laid-out starting point per document kind — a signed two-party
// contract, a formal certificate, or a report cover sheet — rather than a
// blank page of stacked fields, so an admin opens the designer to something
// that already looks like a real document.
//
// Deliberately lightweight: this file (and everything it imports) must stay
// free of @pdfme/generator and PDF_PLUGINS, since the admin template *list*
// page and every "Generate a document" call site (documents.tsx, the lease
// wizard, reports) import from here just to fetch/save template rows or
// build a default — none of them need generate() itself. That lives in
// pdf-generate.ts, imported only where a PDF is actually being rendered, so
// pages that merely list or reference templates don't pay for the designer's
// full rendering stack. See pdf-generate.ts for the split rationale.
export function buildDefaultTemplate(doc: PdfDocumentTypeDef): Template {
  switch (doc.layout) {
    case "certificate":
      return buildCertificateTemplate(doc);
    case "report":
      return buildReportTemplate(doc);
    case "legal":
    default:
      return buildLegalTemplate(doc);
  }
}

export function useAgencyPdfTemplates() {
  const { account } = useAuth();
  return useQuery({
    queryKey: ["pdf-templates", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_template")
        .select("id, document_type, name, template, updated_at");
      if (error) throw error;
      const byType = new Map<string, PdfTemplateRow>();
      for (const row of data ?? []) {
        byType.set(row.document_type, {
          id: row.id,
          documentType: row.document_type,
          name: row.name,
          template: row.template as Template,
          updatedAt: row.updated_at,
        });
      }
      return byType;
    },
  });
}

export function usePdfTemplate(documentType: string | undefined) {
  const { account } = useAuth();
  return useQuery({
    queryKey: ["pdf-template", account?.agencyId, documentType],
    enabled: !!account && !!documentType,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_template")
        .select("id, document_type, name, template, updated_at")
        .eq("document_type", documentType!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const doc = getPdfDocumentType(documentType);
        return doc ? buildDefaultTemplate(doc) : null;
      }
      return data.template as Template;
    },
  });
}

export function useSavePdfTemplate() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  return async (documentType: string, name: string, template: Template) => {
    if (!account) throw new Error("Not signed in.");
    const { error } = await supabase.from("pdf_template").upsert(
      {
        agency_id: account.agencyId,
        document_type: documentType,
        name,
        template,
        updated_by: account.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id,document_type" },
    );
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["pdf-templates", account.agencyId] });
    await queryClient.invalidateQueries({
      queryKey: ["pdf-template", account.agencyId, documentType],
    });
  };
}
