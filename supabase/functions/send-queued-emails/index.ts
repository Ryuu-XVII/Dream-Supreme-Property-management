// Drains public.email_queue and sends each pending row via SMTP, using the
// same SMTP relay already configured under Supabase Auth SMTP settings.
// Invoked on a schedule by pg_cron -> pg_net -> this function (see
// supabase/migrations/20260817000003_email_queue_dispatch.sql). Not invoked
// by end users directly; the caller must present the project's service-role
// key as a bearer token (verified by the platform's own JWT check).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;

interface EmailQueueRow {
  id: string;
  recipient_email: string;
  subject: string;
  body_html: string;
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
    .select("id, recipient_email, subject, body_html, attempts")
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
      await client.send({
        from: smtpFrom!,
        to: row.recipient_email,
        subject: row.subject,
        html: row.body_html,
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
