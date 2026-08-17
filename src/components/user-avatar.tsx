import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/data/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  /** Private R2 object key stored on `user_account.avatar_key`. */
  avatarKey?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Profile photo with an initials fallback.
 *
 * Avatars are private R2 objects, so the key has to be exchanged for a signed
 * URL before it can be rendered. Radix's Avatar shows the fallback both while
 * that request is in flight and if the image fails to load, so a missing,
 * expired, or unreadable avatar degrades to initials instead of a broken image.
 */
export function UserAvatar({ avatarKey, name, className, fallbackClassName }: UserAvatarProps) {
  const { data: avatarUrl } = useAvatarUrl(avatarKey);

  return (
    <Avatar className={cn("size-8", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback className={fallbackClassName}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
