import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function makeTestStub(): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      insert: async () => ({ data: null, error: null }),
      update: async () => ({ data: null, error: null }),
      upsert: async () => ({ data: null, error: null }),
      delete: async () => ({ data: null, error: null }),
    }),
    rpc: async () => ({ data: null, error: null }),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: new Error("Authentication is not available in the unit-test stub."),
      }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({
        data: { user: null },
        error: new Error("Authentication is not available in the unit-test stub."),
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "test.pdf" }, error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: "https://example.com/test.pdf" },
          error: null,
        }),
        remove: async () => ({ error: null }),
      }),
    },
  } as unknown as SupabaseClient;
}

const isTest =
  (typeof process !== "undefined" && process.env?.NODE_ENV === "test") ||
  import.meta.env?.MODE === "test";

const rawSupabase: SupabaseClient =
  url && anonKey
    ? createClient(url, anonKey)
    : isTest
      ? makeTestStub()
      : (() => {
          throw new Error(
            "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and configure the project.",
          );
        })();

/**
 * Shared mutable flag toggled by AuthProvider while an admin is viewing a
 * user's portal in impersonation mode. Read by the guard below so every
 * write (regardless of which module issued it) is blocked in one place —
 * impersonation never obtains a real session for the impersonated user, so
 * this is the only reliable choke point for enforcing read-only mode.
 */
export const impersonationState = { active: false };

const READ_ONLY_MESSAGE =
  "This action is disabled while viewing a user's portal in read-only mode. Exit impersonation to make changes.";

function createBlockedError(): Error {
  return new Error(READ_ONLY_MESSAGE);
}

/** A thenable stand-in for a Postgrest builder that resolves to `{ data: null, error }` no matter how it's chained (`.select().single()`, etc.). */
function createBlockedBuilder(): any {
  const result = { data: null, error: createBlockedError() };
  const handler: ProxyHandler<() => void> = {
    get(_target, prop) {
      if (prop === "then") return (resolve: any) => resolve(result);
      if (prop === "catch") return () => blocked;
      if (prop === "finally")
        return (fn?: () => void) => {
          fn?.();
          return blocked;
        };
      return () => blocked;
    },
    apply() {
      return blocked;
    },
  };
  const blocked: any = new Proxy(function blockedBuilder() {}, handler);
  return blocked;
}

const MUTATION_METHODS = ["insert", "update", "upsert", "delete"] as const;

/** Guards a table's mutation methods without proxying the builder instance itself, so internal `this` bindings (incl. private class fields) stay intact. Exported for unit testing. */
export function guardQueryBuilder<B extends Record<string, any>>(builder: B): B {
  for (const method of MUTATION_METHODS) {
    const original = builder[method];
    if (typeof original !== "function") continue;
    const boundOriginal = original.bind(builder);
    (builder as any)[method] = (...args: unknown[]) => {
      if (impersonationState.active) return createBlockedBuilder();
      return boundOriginal(...args);
    };
  }
  return builder;
}

const originalFrom = rawSupabase.from.bind(rawSupabase);
(rawSupabase as any).from = (table: string) => guardQueryBuilder(originalFrom(table) as any);

const originalRpc = rawSupabase.rpc.bind(rawSupabase);
(rawSupabase as any).rpc = (...args: Parameters<SupabaseClient["rpc"]>) => {
  if (impersonationState.active) return createBlockedBuilder();
  return (originalRpc as any)(...args);
};

const originalStorageFrom = rawSupabase.storage.from.bind(rawSupabase.storage);
(rawSupabase.storage as any).from = (bucket: string) => {
  const bucketApi: any = originalStorageFrom(bucket);
  for (const method of ["upload", "update", "remove", "move", "copy"] as const) {
    const original = bucketApi[method];
    if (typeof original !== "function") continue;
    const boundOriginal = original.bind(bucketApi);
    bucketApi[method] = (...args: unknown[]) => {
      if (impersonationState.active) {
        return Promise.resolve({ data: null, error: createBlockedError() });
      }
      return boundOriginal(...args);
    };
  }
  return bucketApi;
};

export const supabase: SupabaseClient = rawSupabase;
