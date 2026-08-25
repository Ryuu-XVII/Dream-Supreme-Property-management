// Generates a password-recovery link via the Auth admin API (which does not
// itself send any email) and queues it through the app's own email_queue /
// email_template pipeline, so a password-reset email renders with the same
// admin-customizable branded template as every other email type instead of
// Supabase Auth's built-in mailer. Called from the (unauthenticated) login
// page, so verify_jwt is off — the anon key alone gets a caller in the door.
// Always responds with a generic success shape regardless of whether the
// email belongs to a real account, so this endpoint can't be used to probe
// which addresses have accounts.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

const GENERIC_SUCCESS = { success: true };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing required secrets" }, 500);
  }

  let email: string | undefined;
  let redirectTo: string | undefined;
  try {
    const body = await req.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "A valid email is required." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: allowed, error: rateLimitErr } = await supabase.rpc("check_rate_limit", {
    p_key: `request_password_reset:${email}`,
    p_max_attempts: 5,
    p_window: "1 hour",
  });
  if (rateLimitErr) {
    console.error("Rate limit check failed:", rateLimitErr.message);
  } else if (allowed === false) {
    return json({ error: "Too many reset attempts. Please try again later." }, 429);
  }

  // A missing user, a missing user_account row, or a generateLink failure
  // are all silently swallowed below the rate-limit check — every path
  // still returns GENERIC_SUCCESS so the response never reveals whether the
  // address has an account.
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (linkErr || !linkData?.properties?.action_link) {
    if (linkErr && linkErr.message && !/not found|does not exist/i.test(linkErr.message)) {
      console.error("generateLink failed:", linkErr.message);
    }
    return json(GENERIC_SUCCESS);
  }

  const { data: userAccount } = await supabase
    .from("user_account")
    .select("agency_id, full_name")
    .eq("email", email)
    .maybeSingle();

  if (!userAccount?.agency_id) {
    return json(GENERIC_SUCCESS);
  }

  const { error: queueErr } = await supabase.from("email_queue").insert({
    agency_id: userAccount.agency_id,
    recipient_email: email,
    subject: "Reset your Dream Supreme Properties password",
    email_type: "password_reset",
    merge_values: {
      recipientName: userAccount.full_name ?? "",
      resetUrl: linkData.properties.action_link,
    },
    status: "pending",
  });
  if (queueErr) {
    console.error("Could not queue password reset email:", queueErr.message);
  }

  return json(GENERIC_SUCCESS);
});
