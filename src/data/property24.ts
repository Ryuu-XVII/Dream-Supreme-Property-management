import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Matches the shape written by supabase/functions/property24-sync/index.ts.
export interface Property24Profile {
  fullName: string | null;
  photoUrl: string | null;
  agencyName: string | null;
  bio: string | null;
  areasServiced: string[];
  profileUrl: string;
  agentId: string;
}

export interface Property24Listing {
  id: string;
  listingNumber: string;
  purpose: "sale" | "rent";
  url: string;
  title: string | null;
  location: string | null;
  excerpt: string | null;
  priceZar: number | null;
  priceLabel: string | null;
  imageUrl: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  sizeLabel: string | null;
  sizeKind: string | null;
  lastSeenAt: string;
}

export interface AgentProperty24Data {
  profileUrl: string | null;
  profile: Property24Profile | null;
  syncedAt: string | null;
  syncError: string | null;
  listings: Property24Listing[];
}

export const property24QueryKey = (userId?: string) => ["agent-property24", userId] as const;

export function useAgentProperty24(userId?: string) {
  return useQuery<AgentProperty24Data>({
    queryKey: property24QueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const [accountResult, listingsResult] = await Promise.all([
        supabase
          .from("user_account")
          .select("property24_url, property24_profile, property24_synced_at, property24_sync_error")
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("agent_property24_listing")
          .select(
            `id, listing_number, purpose, url, title, location, excerpt,
             price_zar, price_label, image_url, bedrooms, bathrooms, parking,
             size_label, size_kind, last_seen_at`,
          )
          .eq("user_account_id", userId!)
          // Highest-value stock first; unpriced listings sort last.
          .order("price_zar", { ascending: false, nullsFirst: false }),
      ]);

      if (accountResult.error) throw accountResult.error;
      if (listingsResult.error) throw listingsResult.error;

      return {
        profileUrl: accountResult.data?.property24_url ?? null,
        profile: (accountResult.data?.property24_profile as Property24Profile | null) ?? null,
        syncedAt: accountResult.data?.property24_synced_at ?? null,
        syncError: accountResult.data?.property24_sync_error ?? null,
        listings: (listingsResult.data ?? []).map((row: any) => ({
          id: row.id,
          listingNumber: row.listing_number,
          purpose: row.purpose,
          url: row.url,
          title: row.title,
          location: row.location,
          excerpt: row.excerpt,
          priceZar: row.price_zar === null ? null : Number(row.price_zar),
          priceLabel: row.price_label,
          imageUrl: row.image_url,
          bedrooms: row.bedrooms === null ? null : Number(row.bedrooms),
          bathrooms: row.bathrooms === null ? null : Number(row.bathrooms),
          parking: row.parking === null ? null : Number(row.parking),
          sizeLabel: row.size_label,
          sizeKind: row.size_kind,
          lastSeenAt: row.last_seen_at,
        })),
      };
    },
  });
}

export interface Property24SyncResult {
  ok: true;
  syncedAt: string;
  profile: Property24Profile;
  counts: { total: number; sale: number; rent: number };
  pagesFetched: number;
  /**
   * Set when the sync returned no listings while some were already cached —
   * a shape that means Property24 changed its markup far more often than it
   * means the agent genuinely has no stock. The cached listings are kept.
   */
  staleWarning?: string | null;
}

/**
 * Calls the standalone `property24-sync` Cloudflare Worker
 * (workers/property24-sync). It has to run on Cloudflare specifically:
 * Property24 refuses Supabase's egress with a 503 but serves Workers
 * normally, and this app itself deploys as a static SPA with no server
 * runtime of its own.
 */
async function postSync(userAccountId?: string): Promise<Property24SyncResult> {
  const endpoint = import.meta.env.VITE_PROPERTY24_SYNC_URL;
  if (!endpoint) {
    throw new Error("Property24 sync is not configured (VITE_PROPERTY24_SYNC_URL is unset).");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be signed in to sync Property24 listings.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userAccountId }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Sync failed (HTTP ${response.status})`);
  }
  return payload as Property24SyncResult;
}

export function useSyncProperty24() {
  const queryClient = useQueryClient();

  return useMutation<Property24SyncResult, Error, { userAccountId?: string } | void>({
    mutationFn: (variables) => postSync(variables?.userAccountId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: property24QueryKey(variables?.userAccountId),
      });
      void queryClient.invalidateQueries({ queryKey: ["agent-property24"] });
    },
  });
}

/**
 * Fire-and-forget first sync, used right after an invited agent finishes
 * registering. Registration must never fail because Property24 was slow or
 * unreachable, so this deliberately swallows errors — the profile page shows
 * a "Sync now" button, and the edge function records the reason on the
 * account either way.
 */
export async function triggerInitialProperty24Sync(): Promise<void> {
  try {
    await postSync();
  } catch (error) {
    console.warn("Initial Property24 sync did not complete:", error);
  }
}
