import type { EvaluatedBadge } from "@/lib/badges";
import { formatShortDate } from "@/lib/dateFormat";
import BadgeIcon from "@/components/BadgeIcon";

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Locale-independent: this now renders inside the client Goals page, where
// toLocaleDateString would resolve differently on server and device and
// mismatch on hydration (see lib/dateFormat.ts).
const fmtDate = formatShortDate;

// Gold progress ring shown only while a badge is in progress.
function Ring({ frac }: { frac: number }) {
  const r = 29;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, frac));
  return (
    <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" className="text-white/15" strokeWidth="4" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" className="text-gold" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
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
    <div className="elevation-1 flex flex-col items-center gap-2 rounded-3xl p-3">
      <div className={`relative ${ring}`}>
        {!badge.earned && <Ring frac={frac} />}
        <div
          className={[
            "absolute inset-[6px] flex items-center justify-center rounded-full",
            badge.earned
              ? "border-[1.5px] border-gold bg-gold/[0.14] text-gold"
              : "elevation-2 text-muted",
          ].join(" ")}
        >
          <BadgeIcon id={badge.id} size={size === "sm" ? 20 : 24} />
        </div>
        {!badge.earned && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-page text-muted"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
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
          <span className="text-gold">{fmtNum(badge.current)}</span> /{" "}
          {badge.target} {badge.unit}
        </p>
      )}
    </div>
  );
}
