import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Template } from "@pdfme/common";
import { generate } from "@pdfme/generator";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getPdfDocumentType } from "@/lib/pdf-document-types";
import { PDF_PLUGINS } from "@/lib/pdf-plugins";
import { buildReportBreakdownSchemas, stripReportChartSchemas } from "@/lib/pdf-template-layouts";
import { buildDefaultTemplate } from "@/data/pdf-templates";
import {
  getUserStorageUsage,
  recordStorageUsageDelta,
  removeStoredFile,
  uploadFileToR2,
} from "@/lib/storage";

// Everything in this file pulls in @pdfme/generator and PDF_PLUGINS — the
// same rendering stack the designer page needs, multiple megabytes of
// bundle. Kept out of pdf-templates.ts on purpose (see the comment there):
// import from here only in code that actually renders a PDF (a "Generate"
// button), not in anything that merely lists, loads, or saves a template
// row, or those pages pay for this bundle too even though they never call
// generate().

// Shared by both useGeneratePdfDocument (stores the result) and
// useDownloadPdfFromTemplate (just hands it to the browser): loads the
// agency's saved template for a document type, falling back to the built-in
// default when nothing has been customized yet, and merges `inputs` into it.
//
// `chartData`, when given, replaces the report layout's "Breakdown" bar
// chart with one built from real numbers instead of whatever sample or
// admin-placeholder bars the template shipped with — a plain text schema can
// take its value straight from `inputs`, but a bar's *height* is baked into
// its geometry at template-build time, so there's no way to drive it from
// `inputs` the way the KPI tiles are. This is the only way to make report
// PDFs show real proportions without a dedicated pdfme chart plugin.
async function renderPdfFromTemplate(
  documentType: string,
  inputs: Record<string, string>,
  chartData?: { label: string; value: number }[],
) {
  const doc = getPdfDocumentType(documentType);
  if (!doc) throw new Error(`Unknown document type: ${documentType}`);

  const { data: templateRow, error: templateError } = await supabase
    .from("pdf_template")
    .select("template")
    .eq("document_type", documentType)
    .maybeSingle();
  if (templateError) throw templateError;
  const savedTemplate = templateRow?.template as Template | undefined;
  const template = savedTemplate
    ? (structuredClone(savedTemplate) as Template)
    : buildDefaultTemplate(doc);

  if (doc.layout === "report" && chartData) {
    const firstPage = template.schemas[0] ?? [];
    template.schemas[0] = [
      ...stripReportChartSchemas(firstPage),
      ...buildReportBreakdownSchemas(chartData),
    ] as Template["schemas"][number];
  }

  const pdfBytes = await generate({ template, inputs: [inputs], plugins: PDF_PLUGINS });
  return { doc, pdfBytes };
}

// Merges real data into the agency's saved (or default) template and stores
// the resulting PDF exactly the way a normal file upload is stored — same R2
// path convention, quota accounting, and document row — so generated
// documents behave identically to uploaded ones everywhere else in the app
// (download, list, delete).
export function useGeneratePdfDocument() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentType,
      inputs,
      filename,
      dealId,
    }: {
      documentType: string;
      inputs: Record<string, string>;
      filename: string;
      dealId?: string;
    }) => {
      if (!account) throw new Error("Not signed in.");
      const { doc, pdfBytes } = await renderPdfFromTemplate(documentType, inputs);
      const file = new File([pdfBytes.buffer as ArrayBuffer], filename, {
        type: "application/pdf",
      });

      const path = `${account.agencyId}/${dealId ?? "generated"}/${crypto.randomUUID()}-${filename}`;
      const { usedBytes, limitBytes } = await getUserStorageUsage(account.id);
      const storageKey = await uploadFileToR2(file, path, {
        currentStorageUsedBytes: usedBytes,
        storageLimitBytes: limitBytes,
      });
      await recordStorageUsageDelta(account.id, file.size);

      const { data: docData, error: docError } = await supabase
        .from("document")
        .insert({
          agency_id: account.agencyId,
          deal_id: dealId ?? null,
          category: doc.documentCategory ?? "other",
          filename,
          storage_key: storageKey,
          mime_type: "application/pdf",
          size_bytes: file.size,
          version: 1,
          uploaded_by: account.id,
        })
        .select()
        .single();

      if (docError) {
        await removeStoredFile(storageKey).catch(() => undefined);
        await recordStorageUsageDelta(account.id, -file.size).catch(() => undefined);
        throw docError;
      }

      await supabase.rpc("log_audit_event", {
        p_entity_type: "document",
        p_entity_id: docData.id,
        p_action: "Generated document from PDF template",
        p_summary: `Generated "${filename}" from the ${doc.label} template`,
        p_after_json: docData,
      });

      return docData;
    },
    onSuccess: (_, variables) => {
      if (variables.dealId) {
        void queryClient.invalidateQueries({ queryKey: ["documents", "deal", variables.dealId] });
      }
    },
  });
}

// For PDFs that aren't deal/compliance documents (the four report cover
// sheets) — merges real data into the agency's saved (or default) template
// and hands the result straight to the browser as a download, without
// touching R2 storage or the `document` table. Reports aren't uploaded
// files, so there's nothing to persist or attribute storage quota to.
export function useDownloadPdfFromTemplate() {
  return useMutation({
    mutationFn: async ({
      documentType,
      inputs,
      filename,
      chartData,
    }: {
      documentType: string;
      inputs: Record<string, string>;
      filename: string;
      chartData?: { label: string; value: number }[];
    }) => {
      const { pdfBytes } = await renderPdfFromTemplate(documentType, inputs, chartData);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = "noopener";
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  });
}
