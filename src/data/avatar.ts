import { useQuery } from "@tanstack/react-query";
import { getR2FileUrl } from "@/lib/storage";

/**
 * Resolves a private R2 avatar key into a temporary signed URL usable as an
 * <img> src.
 *
 * Avatars live in the same private bucket as every other document, so the
 * stored `avatar_key` is an object key rather than a URL and cannot be rendered
 * directly. The signed URL R2 returns is valid for 300 seconds, so this is
 * refetched a little before that to keep long-lived tabs from rendering a
 * broken image.
 */
export function useAvatarUrl(avatarKey?: string | null) {
  return useQuery({
    queryKey: ["avatar-url", avatarKey],
    enabled: !!avatarKey,
    // Re-sign before the 300s presigned URL expires.
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      try {
        return await getR2FileUrl(avatarKey);
      } catch {
        // A missing or unreadable avatar must never break the surrounding UI —
        // the caller falls back to initials.
        return "";
      }
    },
  });
}
