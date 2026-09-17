import { cn } from "@/lib/utils";
import { initials } from "@/lib/people";

export function PersonChip({
  name,
  variant = "inset",
  size = "md",
}: {
  name: string;
  variant?: "live" | "done" | "waiting" | "inset";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tracking-[0.02em]",
        size === "sm" && "size-[26px] text-[11px]",
        size === "md" && "size-[30px] text-xs",
        size === "lg" && "size-[38px] shrink-0 text-sm",
        variant === "live" && "bg-amber text-docket",
        variant === "done" && "bg-tan text-mute",
        variant === "waiting" && "box-border border border-dashed border-perf text-faint",
        variant === "inset" && "bg-inset text-ink",
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
