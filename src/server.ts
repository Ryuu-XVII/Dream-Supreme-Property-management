import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Per-IP token bucket for SSR page requests. In-memory and single-instance
// only — fine at this project's traffic/deployment scale, but resets on
// restart and won't be shared across multiple server replicas. The real
// public attack surface (anon-callable Supabase RPCs, called directly from
// the browser) is protected separately in Postgres, not here — see
// supabase/migrations/20260817000000_rate_limiting.sql.
const RATE_LIMIT_MAX_REQUESTS = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
// Bounds how large requestBuckets can grow between sweeps. Each distinct IP
// gets its own entry that otherwise lingers forever once it stops sending
// requests, so a long-lived isolate seeing many unique IPs would leak memory
// without this.
const SWEEP_THRESHOLD = 5_000;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function sweepExpiredBuckets(now: number): void {
  for (const [ip, bucket] of requestBuckets) {
    if (now >= bucket.resetAt) requestBuckets.delete(ip);
  }
}

function isRateLimited(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  if (requestBuckets.size > SWEEP_THRESHOLD) sweepExpiredBuckets(now);
  const bucket = requestBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    requestBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (isRateLimited(request)) {
      return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
