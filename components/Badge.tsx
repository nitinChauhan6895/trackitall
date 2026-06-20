import type { EvaluatedBadge } from "@/lib/badges";

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Orange progress ring shown only while a badge is in progress.
function Ring({ frac }: { frac: number }) {
  const r = 29;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, frac));
  return (
    <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" className="text-black/10" strokeWidth="4" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" className="text-orange" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
    </svg>
  );
}

export function Badge({
  badge,
  size = "md",
}: {
  badge: EvaluatedBadge;
  size?: "sm" | "md";
}) {
  const frac = badge.target > 0 ? badge.current / badge.target : 0;
  const ring = size === "sm" ? "h-14 w-14" : "h-16 w-16";

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-white p-3">
      <div className={`relative ${ring}`}>
        {!badge.earned && <Ring frac={frac} />}
        <div
          className={[
            "absolute inset-[6px] flex items-center justify-center rounded-full text-2xl",
            badge.earned
              ? "bg-orange-soft shadow-[0_0_16px_rgba(242,106,44,0.5)] ring-2 ring-orange/60"
              : "bg-black/5",
          ].join(" ")}
        >
          <span aria-hidden className={badge.earned ? "" : "opacity-40 grayscale"}>
            {badge.icon}
          </span>
        </div>
        {!badge.earned && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-[11px] text-white shadow"
          >
            🔒
          </span>
        )}
      </div>

      <p className="flex min-h-[2rem] items-center text-center text-xs font-semibold leading-tight text-ink">
        {badge.label}
      </p>
      {badge.earned ? (
        <p className="text-[11px] font-medium text-muted">
          {badge.earnedDate ? fmtDate(badge.earnedDate) : "Earned"}
        </p>
      ) : (
        <p className="text-[11px] font-medium text-muted">
          <span className="text-orange">{fmtNum(badge.current)}</span> /{" "}
          {badge.target} {badge.unit}
        </p>
      )}
    </div>
  );
}
