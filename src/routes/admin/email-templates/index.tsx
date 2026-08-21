import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { dateFmt } from "@/lib/format";
import { EMAIL_DOCUMENT_TYPES, type EmailDocumentTypeDef } from "@/lib/email-document-types";
import { useAgencyEmailTemplates } from "@/data/email-templates";

export const Route = createFileRoute("/admin/email-templates/")({
  head: () => ({ meta: [{ title: "Email Templates | Dream Supreme Properties" }] }),
  component: EmailTemplatesPage,
});

function EmailTypeCard({ doc }: { doc: EmailDocumentTypeDef }) {
  const templates = useAgencyEmailTemplates();
  const saved = templates.data?.get(doc.id);

  return (
    <Link
      to="/admin/email-templates/$emailType"
      params={{ emailType: doc.id }}
      className="block rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
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

function EmailTemplatesPage() {
  return (
    <>
      <AdminPageHeader
        title="Email Templates"
        description="Design the layout for every transactional email. Each email type has its own customizable template."
      />
      <GlassCard>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EMAIL_DOCUMENT_TYPES.map((doc) => (
            <EmailTypeCard key={doc.id} doc={doc} />
          ))}
        </div>
      </GlassCard>
    </>
  );
}
