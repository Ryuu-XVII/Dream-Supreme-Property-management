// Cloudflare Worker that syncs an agent's public Property24 profile and
// listings into Supabase.
//
// Why a standalone Worker rather than part of the app or a Supabase Edge
// Function:
//   * The app itself deploys as a static SPA (vite build -> dist/ -> nginx),
//     so it has no server runtime to host this.
//   * Property24 serves its own branded "Server unavailable" 503 page to
//     Supabase's egress, so an Edge Function is refused outright. Cloudflare
//     Workers are served normally — verified against the live site.
//
// The browser calls this with the signed-in user's Supabase access token. The
// token is verified against Supabase Auth here; the Supabase secret key never
// leaves this Worker.
import { createClient } from "@supabase/supabase-js";
import { scrapeAgent } from "./property24";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  /** Comma-separated list of browser origins allowed to call this Worker. */
  ALLOWED_ORIGINS: string;
}

// Parsing HTML with cheerio costs real CPU, and a Worker invocation has a
// bounded CPU budget. The nightly job therefore syncs a slice of agents per
// run, always the least-recently-synced first, so the whole roster is covered
// over successive nights instead of one run timing out part-way through.
const SCHEDULED_BATCH_SIZE = 10;

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  // Echo the caller's origin only when it is explicitly allowed. A wildcard
  // would let any site drive this Worker with a stolen token.
  const allowOrigin = origin && allowed.includes(origin) ? origin : (allowed[0] ?? "");
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

interface Caller {
  accountId: string;
  agencyId: string;
  isAdmin: boolean;
}

async function resolveCaller(request: Request, env: Env): Promise<Caller | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;

  // Verified through the publishable key so Supabase Auth validates the token,
  // rather than this Worker trusting whatever the request claims.
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("user_account")
    .select("id, role, agency_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) return null;

  const role = String(account.role ?? "agent").toLowerCase();
  return {
    accountId: account.id,
    agencyId: account.agency_id,
    isAdmin: role === "admin" || role === "admin_agent",
  };
}

interface SyncableAccount {
  id: string;
  agency_id: string;
  property24_url: string;
}

/**
 * Service-role client. Bypasses RLS, so it is only ever constructed after the
 * caller has been authenticated and authorized (or from the cron, which has
 * no caller).
 */
function createAdminClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/**
 * Scrapes one agent and persists the result. Shared by the on-demand HTTP path
 * and the nightly cron so both behave identically, including how a failure is
 * recorded against the profile.
 */
async function syncAccount(admin: SupabaseAdmin, account: SyncableAccount) {
  const startedAt = new Date().toISOString();

  try {
    const { profile, listings, counts, pagesFetched } = await scrapeAgent(account.property24_url);

    if (listings.length > 0) {
      const { error } = await admin.from("agent_property24_listing").upsert(
        listings.map((listing) => ({
          ...listing,
          agency_id: account.agency_id,
          user_account_id: account.id,
          last_seen_at: startedAt,
        })),
        { onConflict: "user_account_id,listing_number" },
      );
      if (error) throw new Error(`Could not save listings: ${error.message}`);
    }

    // Anything not seen in this run has come off Property24 (sold, let, or
    // withdrawn), so drop it rather than leaving stale stock on the profile.
    //
    // Except when the run found nothing at all. A Property24 redesign would
    // still return HTTP 200 while matching none of the `p24_*` selectors, and
    // pruning on that would silently wipe every listing this agent has. An
    // agent genuinely dropping to zero stock is possible but rare, so treat a
    // 0-result run against a non-empty cache as a parser failure: keep what we
    // have, flag it, and let a human look rather than destroying the data.
    let staleWarning: string | null = null;
    if (listings.length === 0) {
      const { count } = await admin
        .from("agent_property24_listing")
        .select("id", { count: "exact", head: true })
        .eq("user_account_id", account.id);

      if ((count ?? 0) > 0) {
        staleWarning =
          `Property24 returned no listings but ${count} are cached — keeping the cached ` +
          `listings. This usually means Property24 changed its page markup and the parser ` +
          `needs updating.`;
        console.error(`property24-sync: ${staleWarning} (account ${account.id})`);
      }
    }

    if (!staleWarning) {
      const { error: pruneError } = await admin
        .from("agent_property24_listing")
        .delete()
        .eq("user_account_id", account.id)
        .lt("last_seen_at", startedAt);
      if (pruneError) throw new Error(`Could not prune old listings: ${pruneError.message}`);
    }

    await admin
      .from("user_account")
      .update({
        property24_profile: profile,
        property24_synced_at: startedAt,
        // A suspected parser failure is surfaced the same way a hard failure
        // is, so it shows on the profile instead of passing as a clean sync.
        property24_sync_error: staleWarning,
      })
      .eq("id", account.id);

    return { ok: true as const, syncedAt: startedAt, profile, counts, pagesFetched, staleWarning };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Property24 sync failed";
    console.error(`property24-sync failed for account ${account.id}:`, error);
    // Surface the failure on the profile instead of silently showing nothing.
    await admin
      .from("user_account")
      .update({ property24_sync_error: message, property24_synced_at: startedAt })
      .eq("id", account.id);
    return { ok: false as const, message };
  }
}

export default {
  // Nightly refresh so listings do not go stale between manual syncs.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const admin = createAdminClient(env);

    const { data: accounts, error } = await admin
      .from("user_account")
      .select("id, agency_id, property24_url, property24_synced_at")
      .not("property24_url", "is", null)
      .eq("status", "active")
      // Never-synced rows sort first, then the stalest.
      .order("property24_synced_at", { ascending: true, nullsFirst: true })
      .limit(SCHEDULED_BATCH_SIZE);

    if (error) {
      console.error("property24-sync cron: could not list accounts:", error.message);
      return;
    }

    let succeeded = 0;
    for (const account of (accounts ?? []) as unknown as SyncableAccount[]) {
      const result = await syncAccount(admin, account);
      if (result.ok) succeeded += 1;
    }
    console.log(
      `property24-sync cron: ${succeeded}/${accounts?.length ?? 0} agents synced successfully`,
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request.headers.get("origin"), env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

    let body: { userAccountId?: string };
    try {
      body = (await request.json()) as { userAccountId?: string };
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    const caller = await resolveCaller(request, env);
    if (!caller) return json({ error: "Invalid or expired session" }, 401, cors);

    // An agent may sync themselves; an admin may sync anyone in their agency.
    const targetId = body.userAccountId ?? caller.accountId;
    if (targetId !== caller.accountId && !caller.isAdmin) {
      return json({ error: "Cannot sync another agent's profile" }, 403, cors);
    }

    const admin = createAdminClient(env);

    const { data: account, error: accountError } = await admin
      .from("user_account")
      .select("id, agency_id, property24_url")
      .eq("id", targetId)
      .maybeSingle();

    if (accountError) return json({ error: accountError.message }, 500, cors);
    if (!account) return json({ error: "Agent profile not found" }, 404, cors);
    // An admin's token must not become a way to reach across agencies.
    if (account.agency_id !== caller.agencyId) {
      return json({ error: "Cannot sync an agent outside your agency" }, 403, cors);
    }
    if (!account.property24_url) {
      return json(
        { error: "no_property24_url", message: "This agent has no Property24 profile URL." },
        400,
        cors,
      );
    }

    const result = await syncAccount(admin, account as unknown as SyncableAccount);
    if (!result.ok) return json({ error: result.message }, 502, cors);

    return json(
      {
        ok: true,
        syncedAt: result.syncedAt,
        profile: result.profile,
        counts: result.counts,
        pagesFetched: result.pagesFetched,
        // Present when the run looked like a parser failure rather than a
        // genuinely empty portfolio, so the caller can warn instead of
        // reporting a clean "synced 0 listings".
        staleWarning: result.staleWarning,
      },
      200,
      cors,
    );
  },
};
