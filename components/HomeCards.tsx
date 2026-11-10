import { Sparkline } from "@/components/Sparkline";

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
