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

export const supabase: SupabaseClient =
  url && anonKey
    ? createClient(url, anonKey)
    : isTest
      ? makeTestStub()
      : (() => {
          throw new Error(
            "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and configure the project.",
          );
        })();
