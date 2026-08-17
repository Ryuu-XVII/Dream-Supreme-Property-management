// Presigned-URL proxy for Cloudflare R2. Cloudflare R2 has no browser-safe,
// RLS-scoped auth mode comparable to Supabase's anon key, so the R2 IAM
// credentials that can sign requests must never reach the client bundle
// (Vite inlines every VITE_-prefixed env var into the built bundle
// regardless of whether the code path runs). This function holds those
// credentials server-side as Supabase secrets and hands the browser a
// short-lived presigned PUT/GET URL instead, so the actual file bytes flow
// directly between the browser and R2 without ever touching Supabase
// Storage. Only object metadata (filename, size, mime type, storage key)
// lives in Postgres — see the `document` table and src/data/documents.ts.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const PUT_URL_EXPIRY_SECONDS = 120;
const GET_URL_EXPIRY_SECONDS = 300;

interface RequestBody {
  action: "status" | "presign-put" | "presign-get" | "delete";
  key?: string;
  contentType?: string;
  isPublic?: boolean;
}

function r2Config() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "dream-supreme-documents";
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

// Browsers send a preflight OPTIONS request before the actual POST and refuse to
// expose the response unless these headers come back, so without them every call
// from the app fails even though the same request succeeds from curl.
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

function objectUrl(accountId: string, bucket: string, key: string): URL {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodedKey}`);
}

async function presign(
  config: NonNullable<ReturnType<typeof r2Config>>,
  method: "PUT" | "GET",
  key: string,
  expiresSeconds: number,
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: "auto",
    service: "s3",
  });
  const url = objectUrl(config.accountId, config.bucket, key);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await client.sign(url.toString(), {
    method,
    aws: { signQuery: true },
  });
  return signed.url;
}

async function deleteObject(
  config: NonNullable<ReturnType<typeof r2Config>>,
  key: string,
): Promise<void> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: "auto",
    service: "s3",
  });
  const url = objectUrl(config.accountId, config.bucket, key);
  const res = await client.fetch(url.toString(), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed with status ${res.status}`);
  }
}

// Mirrors src/lib/storage.ts's verifyStorageAccessAuthorization: admins have
// agency-wide access; agents are restricted to their own `users/<id>/...`
// namespace or their own agency's `<agencyId>/...` namespace. This is a
// second, server-side enforcement point in front of the R2 credentials —
// the Postgres RLS policies remain the authoritative check for anything
// that also flows through Supabase Storage/tables.
async function authorizeKey(
  authHeader: string | null,
  key: string,
  isPublic: boolean | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (isPublic || key.startsWith("public/")) return { ok: true };
  if (!authHeader) return { ok: false, status: 401, error: "Missing Authorization header" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Invalid or expired session" };

  const { data: account } = await supabase
    .from("user_account")
    .select("id, role, agency_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) return { ok: false, status: 403, error: "No agent profile for this session" };

  const role = (account.role ?? "agent").toLowerCase();
  if (role === "admin") return { ok: true };

  const pathParts = key.split("/");
  if (pathParts[0] === "users" && pathParts[1]) {
    if (pathParts[1] !== account.id && pathParts[1] !== user.id) {
      return { ok: false, status: 403, error: "Cannot access another agent's private storage" };
    }
    return { ok: true };
  }
  if (pathParts[0] !== account.agency_id) {
    return { ok: false, status: 403, error: "Cannot access files outside your agency" };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const config = r2Config();

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.action === "status") {
    return json({ configured: !!config });
  }

  if (!config) {
    return json({ error: "r2_not_configured" }, 501);
  }

  if (!body.key) {
    return json({ error: "Missing key" }, 400);
  }

  const authResult = await authorizeKey(req.headers.get("Authorization"), body.key, body.isPublic);
  if (!authResult.ok) {
    return json({ error: authResult.error }, authResult.status);
  }

  try {
    if (body.action === "presign-put") {
      const url = await presign(config, "PUT", body.key, PUT_URL_EXPIRY_SECONDS);
      return json({ url, key: body.key });
    }
    if (body.action === "presign-get") {
      const url = await presign(config, "GET", body.key, GET_URL_EXPIRY_SECONDS);
      return json({ url });
    }
    if (body.action === "delete") {
      await deleteObject(config, body.key);
      return json({ deleted: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(`r2-storage action ${body.action} failed for key ${body.key}:`, err);
    return json({ error: err instanceof Error ? err.message : "R2 operation failed" }, 500);
  }
});
