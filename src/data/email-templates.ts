import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TReaderDocument } from "@usewaypoint/email-builder";
import { renderToStaticMarkup } from "@usewaypoint/email-builder";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getEmailDocumentType } from "@/lib/email-document-types";
import { buildDefaultEmailDocument } from "@/lib/email-template-layouts";
import { ROOT_BLOCK_ID } from "@/lib/email-blocks";
import { mergeEmailDocument, mergeSubject } from "@/lib/email-merge";

export interface EmailTemplateRow {
  id: string;
  emailType: string;
  name: string;
  subject: string;
  document: TReaderDocument;
  updatedAt: string;
}

export function useAgencyEmailTemplates() {
  const { account } = useAuth();
  return useQuery({
    queryKey: ["email-templates", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_template")
        .select("id, email_type, name, subject, document, updated_at");
      if (error) throw error;
      const byType = new Map<string, EmailTemplateRow>();
      for (const row of data ?? []) {
        byType.set(row.email_type, {
          id: row.id,
          emailType: row.email_type,
          name: row.name,
          subject: row.subject,
          document: row.document as TReaderDocument,
          updatedAt: row.updated_at,
        });
      }
      return byType;
    },
  });
}

export interface EmailTemplateState {
  subject: string;
  document: TReaderDocument;
}

export function useEmailTemplate(emailType: string | undefined) {
  const { account } = useAuth();
  return useQuery({
    queryKey: ["email-template", account?.agencyId, emailType],
    enabled: !!account && !!emailType,
    queryFn: async (): Promise<EmailTemplateState | null> => {
      const { data, error } = await supabase
        .from("email_template")
        .select("id, email_type, name, subject, document, updated_at")
        .eq("email_type", emailType!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const doc = getEmailDocumentType(emailType);
        return doc
          ? { subject: doc.defaultSubject, document: buildDefaultEmailDocument(doc) }
          : null;
      }
      return { subject: data.subject, document: data.document as TReaderDocument };
    },
  });
}

export function useSaveEmailTemplate() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  return async (emailType: string, name: string, subject: string, document: TReaderDocument) => {
    if (!account) throw new Error("Not signed in.");
    const { error } = await supabase.from("email_template").upsert(
      {
        agency_id: account.agencyId,
        email_type: emailType,
        name,
        subject,
        document,
        root_block_id: ROOT_BLOCK_ID,
        updated_by: account.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id,email_type" },
    );
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["email-templates", account.agencyId] });
    await queryClient.invalidateQueries({
      queryKey: ["email-template", account.agencyId, emailType],
    });
  };
}

// Loads the agency's saved (or default) template for an email type, merges
// real `{{field}}` values into its subject and blocks, and queues it in
// email_queue for the real SMTP pipeline (send-queued-emails edge function,
// polled by pg_cron) to actually deliver — the same table and dispatch path
// every other transactional email in this app already goes through.
export function useQueueEmailFromTemplate() {
  const { account } = useAuth();
  return useMutation({
    mutationFn: async ({
      emailType,
      recipientEmail,
      values,
    }: {
      emailType: string;
      recipientEmail: string;
      values: Record<string, string>;
    }) => {
      if (!account) throw new Error("Not signed in.");
      const doc = getEmailDocumentType(emailType);
      if (!doc) throw new Error(`Unknown email type: ${emailType}`);

      const { data: templateRow, error: templateError } = await supabase
        .from("email_template")
        .select("subject, document")
        .eq("email_type", emailType)
        .maybeSingle();
      if (templateError) throw templateError;

      const subject = templateRow?.subject ?? doc.defaultSubject;
      const document =
        (templateRow?.document as TReaderDocument | undefined) ?? buildDefaultEmailDocument(doc);

      const mergedDocument = mergeEmailDocument(document, values);
      const mergedSubject = mergeSubject(subject, values);
      const bodyHtml = renderToStaticMarkup(mergedDocument, { rootBlockId: ROOT_BLOCK_ID });

      const { error } = await supabase.from("email_queue").insert({
        agency_id: account.agencyId,
        recipient_email: recipientEmail,
        subject: mergedSubject,
        body_html: bodyHtml,
        status: "pending",
      });
      if (error) throw error;
    },
  });
}
