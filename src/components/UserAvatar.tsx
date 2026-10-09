import { avatarTone, initials } from "@/lib/chat";
import { cn } from "@/lib/utils";

export function UserAvatar({ id, name, size = "md" }: { id?: string | undefined; name?: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-primary-foreground",
        avatarTone(id),
        s,
      )}
    >
      {initials(name)}
    </div>
  );
}
