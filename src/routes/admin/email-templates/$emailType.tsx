import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw, Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmailTemplateEditor } from "@/components/admin/email-template-editor";
import { Button } from "@/components/ui/button";
import { getEmailDocumentType } from "@/lib/email-document-types";
import { buildDefaultEmailDocument } from "@/lib/email-template-layouts";
import { findMissingMergeFields } from "@/lib/email-merge";
import {
  useEmailTemplate,
  useSaveEmailTemplate,
  type EmailTemplateState,
} from "@/data/email-templates";

export const Route = createFileRoute("/admin/email-templates/$emailType")({
  head: ({ params }) => ({
    meta: [{ title: `${params.emailType} email template | Dream Supreme Properties` }],
  }),
  component: EmailTemplateEditorPage,
});

function EmailTemplateEditorPage() {
  const { emailType } = Route.useParams();
  const doc = getEmailDocumentType(emailType);
  const templateQuery = useEmailTemplate(emailType);
  const saveTemplate = useSaveEmailTemplate();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EmailTemplateState | null>(null);

  if (!doc) return <Navigate to="/admin/email-templates" />;

  const state = draft ?? templateQuery.data ?? null;

  const save = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const missing = findMissingMergeFields(
        state.document,
        state.subject,
        Object.keys(doc.sampleInput),
      );
      if (
        missing.length > 0 &&
        !confirm(
          `This template no longer has ${missing.length > 1 ? "fields" : "a field"} for ${missing.join(", ")}. ` +
            `Real data won't be able to fill ${missing.length > 1 ? "these in" : "this in"} — ` +
            `${missing.length > 1 ? "they'll" : "it'll"} be missing from the sent email. Save anyway?`,
        )
      ) {
        return;
      }
      await saveTemplate(doc.id, doc.label, state.subject, state.document);
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
        `Reset the ${doc.label} template to its default layout? Unsaved changes will be lost.`,
      )
    ) {
      return;
    }
    setDraft({ subject: doc.defaultSubject, document: buildDefaultEmailDocument(doc) });
  };

  return (
    <>
      <AdminPageHeader
        title={doc.label}
        description={doc.description}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/email-templates">
                <ArrowLeft className="mr-1.5 size-3.5" /> Back
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={resetToDefault} disabled={!state}>
              <RotateCcw className="mr-1.5 size-3.5" /> Reset to default
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !state}>
              <Save className="mr-1.5 size-3.5" /> {saving ? "Saving…" : "Save template"}
            </Button>
          </>
        }
      />

      {templateQuery.isLoading ? (
        <div className="flex h-75 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : state ? (
        <EmailTemplateEditor
          subject={state.subject}
          document={state.document}
          previewValues={doc.sampleInput}
          onChange={(next) => setDraft(next)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Could not load a starting template.</p>
      )}
    </>
  );
}
