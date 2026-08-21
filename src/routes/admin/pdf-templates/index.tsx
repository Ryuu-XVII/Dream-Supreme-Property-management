import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { dateFmt } from "@/lib/format";
import { PDF_DOCUMENT_TYPES, type PdfDocumentTypeDef } from "@/lib/pdf-document-types";
import { useAgencyPdfTemplates } from "@/data/pdf-templates";

export const Route = createFileRoute("/admin/pdf-templates/")({
  head: () => ({ meta: [{ title: "PDF Templates | Dream Supreme Properties" }] }),
  component: PdfTemplatesPage,
});

function DocumentTypeCard({ doc }: { doc: PdfDocumentTypeDef }) {
  const templates = useAgencyPdfTemplates();
  const saved = templates.data?.get(doc.id);

  return (
    <Link
      to="/admin/pdf-templates/$documentType"
      params={{ documentType: doc.id }}
      className="block rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">{doc.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{doc.description}</p>
          </div>
        </div>
        <Badge variant={saved ? "default" : "outline"} className="shrink-0 text-[10px]">
          {saved ? "Customized" : "Default"}
        </Badge>
      </div>
      {saved && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Last edited {dateFmt(saved.updatedAt)}
        </p>
      )}
    </Link>
  );
}

function PdfTemplatesPage() {
  const groups = Array.from(new Set(PDF_DOCUMENT_TYPES.map((doc) => doc.group)));

  return (
    <>
      <AdminPageHeader
        title="PDF Templates"
        description="Design the layout for every generated document. Each document type has its own customizable template."
      />
      <div className="space-y-6">
        {groups.map((group) => (
          <GlassCard key={group}>
            <h2 className="mb-4 font-display text-base font-semibold">{group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PDF_DOCUMENT_TYPES.filter((doc) => doc.group === group).map((doc) => (
                <DocumentTypeCard key={doc.id} doc={doc} />
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
