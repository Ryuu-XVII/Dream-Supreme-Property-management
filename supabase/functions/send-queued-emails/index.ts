// Drains public.email_queue and sends each pending row via SMTP, using the
// same SMTP relay already configured under Supabase Auth SMTP settings.
// Invoked on a schedule by pg_cron -> pg_net -> this function (see
// supabase/migrations/20260817000003_email_queue_dispatch.sql). Not invoked
// by end users directly; the caller must present the project's service-role
// key as a bearer token (verified by the platform's own JWT check).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { renderTemplatedEmail } from "./email-render.ts";

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;

interface EmailQueueRow {
  id: string;
  agency_id: string;
  recipient_email: string;
  subject: string;
  body_html: string | null;
  email_type: string | null;
  merge_values: Record<string, string> | null;
  attempts: number;
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM") ?? smtpUser;

  if (!supabaseUrl || !serviceRoleKey || !smtpHost || !smtpUser || !smtpPass) {
    return new Response(JSON.stringify({ error: "Missing required secrets" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: smtpPort === 465,
      auth: { username: smtpUser, password: smtpPass },
    },
  });

  const { data: rows, error: fetchError } = await supabase
    .from("email_queue")
    .select(
      "id, agency_id, recipient_email, subject, body_html, email_type, merge_values, attempts",
    )
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;
  for (const row of (rows ?? []) as EmailQueueRow[]) {
    try {
      // Rows produced by a known email type (deal_notification,
      // daily_notification_digest, team_invitation, ...) carry structured
      // merge_values instead of pre-built HTML — render the agency's saved
      // (or default) template for that type now, right before sending, so
      // an admin's customization always reflects in the actual email. Falls
      // back to the row's plain subject/body_html if there's no email_type,
      // or if template rendering itself throws, so a broken custom template
      // never blocks delivery outright.
      let subject = row.subject;
      let html = row.body_html;
      if (row.email_type) {
        try {
          const rendered = await renderTemplatedEmail(
            async () => {
              const { data } = await supabase
                .from("email_template")
                .select("subject, document")
                .eq("agency_id", row.agency_id)
                .eq("email_type", row.email_type)
                .maybeSingle();
              return data ? { subject: data.subject, document: data.document } : null;
            },
            row.email_type,
            row.merge_values ?? {},
          );
          subject = rendered.subject;
          html = rendered.html;
        } catch (renderErr) {
          console.error(`Template render failed for email_queue row ${row.id}:`, renderErr);
          if (!html) throw renderErr;
        }
      }
      if (!html) throw new Error(`email_queue row ${row.id} has no renderable body`);

      await client.send({
        from: smtpFrom!,
        to: row.recipient_email,
        subject,
        html,
      });
      await supabase
        .from("email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent += 1;
    } catch (err) {
      const attempts = row.attempts + 1;
      await supabase
        .from("email_queue")
        .update({ attempts, status: attempts >= MAX_ATTEMPTS ? "failed" : "pending" })
        .eq("id", row.id);
      failed += 1;
      console.error(`Failed to send email_queue row ${row.id}:`, err);
    }
  }
  await client.close();

  return new Response(JSON.stringify({ processed: (rows ?? []).length, sent, failed }), {
    headers: { "content-type": "application/json" },
  });
});
