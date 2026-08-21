import { lazy, Suspense, useRef, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw, Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import type { PdfTemplateDesignerHandle } from "@/components/admin/pdf-template-designer";
import { Button } from "@/components/ui/button";
import { getPdfDocumentType } from "@/lib/pdf-document-types";
import { buildDefaultTemplate, usePdfTemplate, useSavePdfTemplate } from "@/data/pdf-templates";
import { findMissingMergeFields } from "@/lib/pdf-template-layouts";

// Dynamically imported (not a static top-level import) so @pdfme/ui's ~4MB
// canvas-editor bundle only ever downloads when this designer actually
// renders, on this one route — a static import here let Rollup's automatic
// chunking pull the same weight into a chunk the plain admin template *list*
// page also depended on, even though it never uses the designer at all.
const PdfTemplateDesigner = lazy(() =>
  import("@/components/admin/pdf-template-designer").then((m) => ({
    default: m.PdfTemplateDesigner,
  })),
);

export const Route = createFileRoute("/admin/pdf-templates/$documentType")({
  head: ({ params }) => ({
    meta: [{ title: `${params.documentType} template | Dream Supreme Properties` }],
  }),
  component: PdfTemplateEditorPage,
});

function PdfTemplateEditorPage() {
  const { documentType } = Route.useParams();
  const doc = getPdfDocumentType(documentType);
  const templateQuery = usePdfTemplate(documentType);
  const saveTemplate = useSavePdfTemplate();
  const designerRef = useRef<PdfTemplateDesignerHandle>(null);
  const [saving, setSaving] = useState(false);
  // Bumping this remounts <PdfTemplateDesigner>, which is how "Reset to
  // default" applies without teaching the designer wrapper to swap templates
  // on an existing instance.
  const [designerKey, setDesignerKey] = useState(0);
  const [resetTemplate, setResetTemplate] = useState<typeof templateQuery.data>(undefined);

  if (!doc) return <Navigate to="/admin/pdf-templates" />;

  const save = async () => {
    if (!designerRef.current) return;
    setSaving(true);
    try {
      const template = designerRef.current.getTemplate();
      const missing = findMissingMergeFields(doc, template);
      if (
        missing.length > 0 &&
        !confirm(
          `This template no longer has a field named ${missing.join(", ")}. ` +
            `Real data won't be able to fill ${missing.length > 1 ? "these fields" : "this field"} in — ` +
            `it'll render blank. Save anyway?`,
        )
      ) {
        return;
      }
      await saveTemplate(doc.id, doc.label, template);
      toast.success("Template saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the template.");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (
      !confirm(
        `Reset the ${doc.label} template to its default layout? Unsaved changes to the canvas will be lost.`,
      )
    ) {
      return;
    }
    setResetTemplate(buildDefaultTemplate(doc));
    setDesignerKey((k) => k + 1);
  };

  const activeTemplate = resetTemplate ?? templateQuery.data;

  return (
    <>
      <AdminPageHeader
        title={doc.label}
        description={doc.description}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/pdf-templates">
                <ArrowLeft className="mr-1.5 size-3.5" /> Back
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={resetToDefault} disabled={!activeTemplate}>
              <RotateCcw className="mr-1.5 size-3.5" /> Reset to default
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !activeTemplate}>
              <Save className="mr-1.5 size-3.5" /> {saving ? "Saving…" : "Save template"}
            </Button>
          </>
        }
      />

      {templateQuery.isLoading ? (
        <div className="flex h-75 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeTemplate ? (
        <Suspense
          fallback={
            <div className="flex h-75 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <PdfTemplateDesigner key={designerKey} ref={designerRef} template={activeTemplate} />
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">Could not load a starting template.</p>
      )}
    </>
  );
}
