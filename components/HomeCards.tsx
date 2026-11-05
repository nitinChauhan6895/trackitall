import Link from "next/link";
import { splitPrValue, type Pr } from "@/lib/types";
import { Sparkline } from "@/components/Sparkline";

// Home PR Corner tile: exercise, best value (unit in green) and reps.
export function PrCard({ pr }: { pr: Pr }) {
  const { value, unit } = splitPrValue(pr);
  return (
    <Link href="/prs" className="elevation-1 pressable flex flex-col gap-[18px] rounded-3xl p-[18px] text-ink">
      <span className="truncate text-sm font-semibold text-[#D4D4D4]">{pr.exercise_name}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-display text-[34px] font-bold leading-none">
          {value}
          {unit && <span className="text-[15px] font-semibold text-green"> {unit}</span>}
        </span>
        <span className="text-[13px] text-muted">{pr.reps != null ? `× ${pr.reps} reps` : "Personal best"}</span>
      </span>
    </Link>
  );
}

// Measurement card with a sparkline + month delta.
export function MeasurementCard({
  label,
  value,
  unit,
  delta,
  series,
  colorClass,
}: {
  label: string;
  value: string;
  unit: string;
  delta: number | null;
  series: number[];
  colorClass: string;
}) {
  return (
    <div className="elevation-1 rounded-3xl p-3.5">
      <p className="truncate text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-ink">{value}</span>
          <span className="text-xs font-semibold text-muted">{unit}</span>
        </div>
        <div className={`h-8 min-w-0 max-w-24 flex-1 ${colorClass}`}>
          <Sparkline values={series} className="h-full w-full" />
        </div>
      </div>
      {delta != null && delta !== 0 && (
        <p
          className={[
            "mt-2 text-xs font-medium",
            delta < 0 ? "text-green" : "text-gold",
          ].join(" ")}
        >
          {delta < 0 ? "↓" : "↑"} {Math.abs(delta)} {unit} this month
        </p>
      )}
    </div>
  );
}
