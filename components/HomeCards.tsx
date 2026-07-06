import { formatPrValue, prIcon, type Pr } from "@/lib/types";
import { Sparkline } from "@/components/Sparkline";
import ExerciseLogo from "@/components/ExerciseLogo";

function isRecent(dateKey: string | null, days = 21): boolean {
  if (!dateKey) return false;
  const [y, m, d] = dateKey.split("-").map(Number);
  const then = Date.UTC(y, m - 1, d);
  return Date.now() - then <= days * 86400000;
}

// Dark "hero" PR card. (Background photo can be layered in later.)
export function PrCard({ pr }: { pr: Pr }) {
  const recent = isRecent(pr.achieved_date);
  const tag = pr.unit_type === "kg" ? "NEW PR" : "NEW BEST";
  return (
    <div className="relative flex min-h-[120px] flex-col justify-between overflow-hidden rounded-2xl border border-green/20 bg-surface-2 p-4 text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-green/10 to-transparent"
      />
      <div className="relative flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 p-1">
          <ExerciseLogo name={pr.exercise_name} fallback={prIcon(pr)} className="h-full w-full text-base" />
        </span>
        <span className="truncate text-sm font-medium text-ink/90">
          {pr.exercise_name}
        </span>
      </div>
      <div className="relative mt-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-green">{formatPrValue(pr)}</span>
          {pr.reps != null && (
            <span className="text-sm font-semibold text-muted">
              × {pr.reps}
            </span>
          )}
        </div>
        {recent && (
          <span className="mt-2 inline-block rounded-md bg-orange px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            {tag}
          </span>
        )}
      </div>
    </div>
  );
}

// Measurement card with a sparkline + month delta.
export function MeasurementCard({
  icon,
  label,
  value,
  unit,
  delta,
  series,
  colorClass,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  delta: number | null;
  series: number[];
  colorClass: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="text-base">
              {icon}
            </span>
            <span className="truncate text-xs font-medium text-muted">
              {label}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-ink">{value}</span>
            <span className="text-xs font-semibold text-muted">{unit}</span>
          </div>
        </div>
        <div className={`h-9 w-24 shrink-0 ${colorClass}`}>
          <Sparkline values={series} className="h-full w-full" />
        </div>
      </div>
      {delta != null && delta !== 0 && (
        <p
          className={[
            "mt-2 text-xs font-medium",
            delta < 0 ? "text-green" : "text-orange",
          ].join(" ")}
        >
          {delta < 0 ? "↓" : "↑"} {Math.abs(delta)} {unit} this month
        </p>
      )}
    </div>
  );
}
