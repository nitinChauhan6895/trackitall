import type { EvaluatedBadge } from "@/lib/badges";

// A single badge. Earned badges glow; locked badges are greyed + blurred.
export function Badge({
  badge,
  size = "md",
}: {
  badge: EvaluatedBadge;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-14 w-14 text-2xl" : "h-16 w-16 text-3xl";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={[
          "flex items-center justify-center rounded-full transition",
          dim,
          badge.earned
            ? "bg-orange-soft text-orange shadow-[0_0_16px_rgba(216,90,48,0.45)] ring-2 ring-orange/60"
            : "bg-black/5 text-ink/40 opacity-60 blur-[1.5px]",
        ].join(" ")}
      >
        <span aria-hidden>{badge.icon}</span>
      </div>
      <span
        className={[
          "max-w-[5.5rem] text-center text-xs font-medium leading-tight",
          badge.earned ? "text-ink" : "text-muted",
        ].join(" ")}
      >
        {badge.label}
      </span>
    </div>
  );
}
