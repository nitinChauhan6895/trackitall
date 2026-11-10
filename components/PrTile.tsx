import Link from "next/link";
import { formatPrDelta, formatPrValue, prTitle, type PrMetric } from "@/lib/prs";

/**
 * A PR tile: icon, exercise, what kind of record it is, the value and a green
 * increment chip ("▲ 2.5 kg"). Used on the day view (new PRs that day), in PR
 * corner's "Recent" strip and on Home.
 */
export default function PrTile({
  name,
  metric,
  value,
  delta,
  reps,
  href,
  className = "",
}: {
  name: string;
  metric: PrMetric;
  value: number;
  /** null for a baseline (first log), which has no increment yet. */
  delta: number | null;
  reps?: number | null;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <PrIcon metric={metric} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] text-muted">{name}</span>
        <span className="truncate text-[15px] font-semibold text-ink">{prTitle(metric)}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="elevation-2 rounded-full px-2.5 py-1 text-[13px] font-semibold text-ink">
          {formatPrValue(metric, value)}
          {metric === "weight" && reps ? <span className="font-normal text-muted"> × {reps}</span> : null}
        </span>
        {delta != null && delta > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-green/[0.12] px-2.5 py-1 text-[13px] font-semibold text-green">
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
              <path d="M5 1l4 7H1z" fill="currentColor" />
            </svg>
            <span className="sr-only">up </span>
            {formatPrDelta(metric, delta)}
          </span>
        )}
      </span>
    </>
  );
  // `relative` keeps the sr-only text positioned inside the tile; without it,
  // tiles scrolled off-screen in a strip stretched the whole page sideways.
  const cls = `elevation-1 relative flex flex-col gap-3 rounded-3xl p-4 text-left ${className}`;
  return href ? (
    <Link href={href} className={`${cls} pressable`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Gold-tinted circle: dumbbell for lifts, route for distance, timer for duration. */
export function PrIcon({ metric, size = 40 }: { metric: PrMetric; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-gold/[0.14] text-gold"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {metric === "weight" ? (
          <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
        ) : metric === "distance" ? (
          <>
            <circle cx="6" cy="18" r="2" />
            <circle cx="18" cy="6" r="2" />
            <path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
          </>
        ) : (
          <>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2M9 2h6" />
          </>
        )}
      </svg>
    </span>
  );
}
