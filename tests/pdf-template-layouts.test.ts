import { describe, expect, it } from "vitest";
import { generate } from "@pdfme/generator";
import { PDF_DOCUMENT_TYPES } from "@/lib/pdf-document-types";
import { PDF_PLUGINS } from "@/lib/pdf-plugins";
import {
  buildCertificateTemplate,
  buildLegalTemplate,
  buildReportTemplate,
} from "@/lib/pdf-template-layouts";

const BUILDERS = {
  legal: buildLegalTemplate,
  certificate: buildCertificateTemplate,
  report: buildReportTemplate,
} as const;

describe("default PDF template layouts", () => {
  for (const doc of PDF_DOCUMENT_TYPES) {
    it(`renders a real PDF for ${doc.id} (${doc.layout})`, async () => {
      const template = BUILDERS[doc.layout](doc);

      // Every merge-field schema's name must be a sampleInput key so
      // useGeneratePdfDocument's `inputs` can actually target it.
      const schemaNames = template.schemas.flat().map((s) => s.name);
      for (const key of Object.keys(doc.sampleInput)) {
        expect(schemaNames).toContain(key);
      }

      const pdf = await generate({
        template,
        inputs: [doc.sampleInput],
        plugins: PDF_PLUGINS,
      });

      // A real, non-trivial PDF was produced (magic header, meaningful size).
      expect(Buffer.from(pdf.slice(0, 5)).toString("utf8")).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(1000);
    });
  }
});
