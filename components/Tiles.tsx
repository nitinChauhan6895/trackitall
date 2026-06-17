import { formatPrValue, prIcon, type Pr } from "@/lib/types";
import ExerciseLogo from "@/components/ExerciseLogo";

// Square PR tile (2-col grid). Beige/orange PR styling (#FAECE7).
// `onEdit` is optional — when provided, a small pencil shows in the top-right.
// (Plain component, no hooks, so it can render in both server and client trees;
//  only pass onEdit from a client component.)
export function PrTile({ pr, onEdit }: { pr: Pr; onEdit?: () => void }) {
  return (
    <div className="relative rounded-2xl bg-orange-soft p-3">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${pr.exercise_name}`}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm text-orange active:bg-orange/10"
        >
          ✎
        </button>
      )}
      <div className="flex items-center gap-1.5">
        <span className="h-5 w-5 shrink-0">
          <ExerciseLogo name={pr.exercise_name} fallback={prIcon(pr)} className="h-full w-full text-base" />
        </span>
        <p className="truncate text-xs font-medium text-ink">
          {pr.exercise_name}
        </p>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-bold leading-none text-orange">
          {formatPrValue(pr)}
        </span>
        {pr.reps != null && (
          <span className="text-xs font-semibold text-orange/70">
            ×{pr.reps}
          </span>
        )}
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
    <div className="rounded-2xl bg-green-tint p-3">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="text-base">
          {icon}
        </span>
        <p className="truncate text-xs font-medium text-ink">{label}</p>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-bold leading-none text-green">
          {value}
        </span>
        <span className="text-xs font-semibold text-green/70">{unit}</span>
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
