import { formatPrValue, prIcon, type Pr } from "@/lib/types";

// Square PR tile (2-col grid). Beige/orange PR styling (#FAECE7).
// `onEdit` is optional — when provided, a small pencil shows in the top-right.
// (Plain component, no hooks, so it can render in both server and client trees;
//  only pass onEdit from a client component.)
export function PrTile({ pr, onEdit }: { pr: Pr; onEdit?: () => void }) {
  return (
    <div className="relative flex aspect-square flex-col justify-between rounded-2xl bg-orange-soft p-4">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${pr.exercise_name}`}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-orange active:bg-orange/10"
        >
          ✎
        </button>
      )}
      <span aria-hidden className="text-2xl">
        {prIcon(pr)}
      </span>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold leading-none text-orange">
            {formatPrValue(pr)}
          </span>
          {pr.reps != null && (
            <span className="text-sm font-semibold text-orange/70">
              ×{pr.reps}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-ink">
          {pr.exercise_name}
        </p>
      </div>
    </div>
  );
}

// Square metric tile (2-col grid). Green tint styling (#EAF3DE / #3B6D11).
export function MetricTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex aspect-square flex-col justify-between rounded-2xl bg-green-tint p-4">
      <span aria-hidden className="text-2xl">
        {icon}
      </span>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold leading-none text-green">
            {value}
          </span>
          <span className="text-sm font-semibold text-green/70">{unit}</span>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-ink">{label}</p>
      </div>
    </div>
  );
}

const METRIC_ICONS: Record<string, string> = {
  bodyweight: "⚖️",
  height: "📐",
  age: "🎂",
  body_fat_pct: "📊",
  chest: "🫁",
  shoulders: "🧍",
  waist: "📏",
  navel: "⭕",
  arms: "💪",
  thighs: "🦵",
};

export function metricIcon(key: string): string {
  return METRIC_ICONS[key] ?? "📏";
}
