"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadGoalsAction, saveGoal, deleteGoal } from "@/app/actions";
import { qk } from "@/lib/browserData";
import { toDateKey } from "@/lib/date";
import { formatShortDate } from "@/lib/dateFormat";
import {
  GOAL_METRICS,
  GOAL_META,
  GROUP_SCOPED,
  computeProgress,
  formatValue,
  goalTitle,
  isActive,
  thisMonth,
  thisWeek,
  type Goal,
  type GoalExercise,
  type GoalMetric,
  type GoalProgress,
} from "@/lib/goals";
import {
  CARDIO_TYPES,
  CARDIO_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
} from "@/lib/types";
import { Badge } from "@/components/Badge";
import type { EvaluatedBadge } from "@/lib/badges";

// Groups offered for a scoped goal — cardio/HIIT aren't "sets" work.
const SCOPE_GROUPS = MUSCLE_GROUPS.filter((g) => g !== "cardio" && g !== "hiit");

const INPUT =
  "w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-green";

type Tab = "overview" | "active" | "history";
type View = { name: "list" } | { name: "detail"; id: string } | { name: "new" | "edit"; id?: string };

export type GoalsData = { goals: Goal[]; exercises: GoalExercise[] };

export default function GoalsClient({
  initial,
  badges,
  todayKey,
}: {
  initial: GoalsData;
  badges: EvaluatedBadge[];
  /** The SERVER's date — seeding from it keeps SSR and first client render
   *  identical; the device's real date is applied on mount. */
  todayKey: string;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: qk.goals(),
    queryFn: loadGoalsAction,
    initialData: initial,
  });
  const goals = data?.goals ?? [];
  const exercises = data?.exercises ?? [];

  const [today, setToday] = useState(todayKey);
  useEffect(() => setToday(toDateKey(new Date())), []);

  const [tab, setTab] = useState<Tab>("overview");
  const [view, setView] = useState<View>({ name: "list" });
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.goals() });

  // Write a saved goal straight into the cache so it shows without waiting on
  // a refetch — the reason a new goal used to need an app restart to appear.
  function upsertGoalCache(saved: Goal) {
    queryClient.setQueryData<GoalsData>(qk.goals(), (prev) => {
      if (!prev) return { goals: [saved], exercises: [] };
      const rest = prev.goals.filter((g) => g.id !== saved.id);
      return { ...prev, goals: [saved, ...rest] };
    });
  }

  const progressOf = (g: Goal) => computeProgress(g, exercises, today);
  const active = goals.filter((g) => isActive(g, today));
  const past = goals.filter((g) => !isActive(g, today));

  const detail = view.name === "detail" ? goals.find((g) => g.id === view.id) : null;

  if (view.name === "new" || view.name === "edit") {
    return (
      <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
        <GoalForm
          goal={view.id ? goals.find((g) => g.id === view.id) : undefined}
          today={today}
          onDone={(saved) => {
            upsertGoalCache(saved);
            setView({ name: "list" });
            refresh();
          }}
          onCancel={() => setView({ name: "list" })}
        />
      </main>
    );
  }

  if (view.name === "detail" && detail) {
    return (
      <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
        <GoalDetail
          goal={detail}
          progress={progressOf(detail)}
          today={today}
          onBack={() => setView({ name: "list" })}
          onEdit={() => setView({ name: "edit", id: detail.id })}
          onDeleted={() => {
            setView({ name: "list" });
            refresh();
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-start justify-between gap-3 pb-3 pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals &amp; Badges</h1>
          <p className="mt-0.5 text-sm text-muted">Track your progress. Stay consistent.</p>
        </div>
      </header>

      <div className="flex rounded-xl bg-white/[0.06] p-1">
        {(["overview", "active", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition",
              tab === t ? "bg-green text-ink-inverse" : "text-muted",
            ].join(" ")}
          >
            {t === "active" ? "Active Goals" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview
          goals={active}
          progressOf={progressOf}
          badges={badges}
          onOpen={(id) => setView({ name: "detail", id })}
          onNew={() => setView({ name: "new" })}
        />
      )}

      {tab === "active" && (
        <ActiveGoals
          goals={active}
          progressOf={progressOf}
          onOpen={(id) => setView({ name: "detail", id })}
          onNew={() => setView({ name: "new" })}
        />
      )}

      {tab === "history" && (
        <History goals={past} progressOf={progressOf} onOpen={(id) => setView({ name: "detail", id })} />
      )}
    </main>
  );
}

// ---------------- overview ----------------

function Overview({
  goals,
  progressOf,
  badges,
  onOpen,
  onNew,
}: {
  goals: Goal[];
  progressOf: (g: Goal) => GoalProgress;
  badges: EvaluatedBadge[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  // The headline ring averages the active goals — one number for "am I on
  // track", rather than making you read five bars.
  const overall =
    goals.length === 0
      ? 0
      : Math.round((goals.reduce((n, g) => n + progressOf(g).ratio, 0) / goals.length) * 100);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <>
      <section className="mt-4 rounded-2xl border border-white/10 bg-surface p-4">
        <p className="text-sm font-medium text-ink">Today&rsquo;s Progress</p>
        <div className="mt-3 flex items-center gap-4">
          <Ring percent={overall} />
          <div className="min-w-0 flex-1 space-y-2.5">
            {goals.length === 0 && (
              <p className="text-sm text-muted">No active goals yet.</p>
            )}
            {goals.slice(0, 3).map((g) => {
              const p = progressOf(g);
              const meta = GOAL_META[g.metric];
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onOpen(g.id)}
                  className="block w-full text-left"
                >
                  <span className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-ink">{goalTitle(g)}</span>
                    <span className="shrink-0 text-muted">
                      {formatValue(g.metric, p.value)} / {formatValue(g.metric, p.target)}
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${p.ratio * 100}%`, background: meta.tone }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {goals.length > 0 && (
        <>
          <SectionLabel>Active goals</SectionLabel>
          <ul className="space-y-2.5">
            {goals.map((g) => (
              <li key={g.id}>
                <GoalCard goal={g} progress={progressOf(g)} onClick={() => onOpen(g.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        onClick={onNew}
        className="mt-5 w-full rounded-2xl bg-green px-4 py-3.5 text-base font-bold text-ink-inverse transition active:scale-[0.98]"
      >
        + Add New Goal
      </button>

      {/* Badges live here now rather than on their own page. */}
      <SectionLabel>Badges</SectionLabel>
      <p className="mb-2 text-xs text-muted">
        {earned} of {badges.length} earned
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {badges.map((b) => (
          <Badge key={b.id} badge={b} />
        ))}
      </div>
    </>
  );
}

// ---------------- active + history lists ----------------

function ActiveGoals({
  goals,
  progressOf,
  onOpen,
  onNew,
}: {
  goals: Goal[];
  progressOf: (g: Goal) => GoalProgress;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState("All");
  const groups = ["All", "Strength", "Cardio", "Running"];
  const shown = goals.filter((g) => filter === "All" || GOAL_META[g.metric].group === filter);

  return (
    <>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {groups.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={[
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              filter === f ? "bg-green text-ink-inverse" : "bg-white/[0.06] text-muted",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyGoals onNew={onNew} />
      ) : (
        <ul className="mt-3 space-y-2.5">
          {shown.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} progress={progressOf(g)} onClick={() => onOpen(g.id)} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-surface p-4">
        <span aria-hidden className="text-2xl">
          🏆
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Keep it up!</span>
          <span className="block text-xs text-muted">You&rsquo;re building great habits.</span>
        </span>
      </div>
    </>
  );
}

function History({
  goals,
  progressOf,
  onOpen,
}: {
  goals: Goal[];
  progressOf: (g: Goal) => GoalProgress;
  onOpen: (id: string) => void;
}) {
  if (goals.length === 0) {
    return (
      <p className="mt-10 rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-muted">
        Finished goals will appear here.
      </p>
    );
  }
  return (
    <ul className="mt-4 space-y-2.5">
      {goals.map((g) => {
        const p = progressOf(g);
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onOpen(g.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-surface p-3 text-left"
            >
              <span aria-hidden className="text-xl">
                {p.complete ? "✅" : "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{goalTitle(g)}</span>
                <span className="block text-xs text-muted">
                  {formatShortDate(g.start_date)} – {formatShortDate(g.end_date)}
                </span>
              </span>
              <span
                className="shrink-0 text-sm font-bold"
                style={{ color: p.complete ? "#A8E830" : "#8D9483" }}
              >
                {p.percent}%
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function GoalCard({
  goal,
  progress,
  onClick,
}: {
  goal: Goal;
  progress: GoalProgress;
  onClick: () => void;
}) {
  const meta = GOAL_META[goal.metric];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-white/10 bg-surface p-3 text-left active:bg-white/[0.04]"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${meta.tone}1F` }}
        >
          {meta.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{goalTitle(goal)}</span>
          <span className="block truncate text-xs text-muted">{meta.blurb}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-bold text-ink">{formatValue(goal.metric, goal.target)}</span>
          <span className="block text-[10px] text-muted">{meta.unit}</span>
        </span>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${progress.ratio * 100}%`, background: meta.tone }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span style={{ color: meta.tone }}>
          {formatValue(goal.metric, progress.value)} / {formatValue(goal.metric, progress.target)}{" "}
          {meta.unit}
        </span>
        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted">
          {progress.daysLeft === 0
            ? "ended"
            : `${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} left`}
        </span>
      </div>
    </button>
  );
}

// ---------------- detail ----------------

function GoalDetail({
  goal,
  progress,
  today,
  onBack,
  onEdit,
  onDeleted,
}: {
  goal: Goal;
  progress: GoalProgress;
  today: string;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const meta = GOAL_META[goal.metric];
  const [confirm, setConfirm] = useState(false);
  const max = Math.max(...progress.perDay.map((d) => d.value), 1);
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <>
      <header className="flex items-center justify-between py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink active:bg-white/10"
        >
          ←
        </button>
        <h1 className="truncate px-2 text-base font-bold">{goalTitle(goal)}</h1>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted active:bg-white/10"
        >
          Edit
        </button>
      </header>

      <div className="flex flex-col items-center py-4">
        <Ring percent={progress.percent} size={180} tone={meta.tone} />
        <p className="mt-2 text-sm text-muted">
          {formatValue(goal.metric, progress.value)} / {formatValue(goal.metric, progress.target)}{" "}
          {meta.unit}
        </p>
        <p className="mt-1 text-xs text-muted">
          {progress.daysLeft === 0
            ? "This goal has ended"
            : `${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} left`}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface p-4">
        <span>
          <span className="block text-sm font-medium text-ink">Target</span>
          <span className="block text-xs text-muted">
            {formatShortDate(goal.start_date)} – {formatShortDate(goal.end_date)}
          </span>
        </span>
        <span className="text-sm font-bold" style={{ color: meta.tone }}>
          {formatValue(goal.metric, goal.target)} {meta.unit}
        </span>
      </div>

      <SectionLabel>Progress</SectionLabel>
      <div className="rounded-2xl border border-white/10 bg-surface p-4">
        <div className="flex h-[140px] items-end gap-1">
          {progress.perDay.map((d, i) => {
            const future = d.date > today;
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] font-semibold text-ink/70">
                  {d.value > 0 ? formatValue(goal.metric, d.value) : ""}
                </span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: d.value > 0 ? `${Math.max(6, (d.value / max) * 100)}%` : "2%",
                    background: d.value > 0 ? meta.tone : future ? "#22251C" : "#33362C",
                  }}
                />
                <span className="text-[9px] text-muted">
                  {progress.perDay.length <= 7
                    ? DOW[i]
                    : i % 5 === 0
                      ? Number(d.date.slice(8, 10))
                      : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <SectionLabel>Insights</SectionLabel>
      <div className="rounded-2xl border border-white/10 bg-surface p-4">
        <p className="text-sm text-ink">{insight(goal, progress)}</p>
      </div>

      <SectionLabel>About this goal</SectionLabel>
      <div className="rounded-2xl border border-white/10 bg-surface p-4">
        <p className="text-sm text-muted">{aboutText(goal.metric)}</p>
        {goal.notes && <p className="mt-2 text-sm text-ink">{goal.notes}</p>}
      </div>

      <div className="mt-5">
        {confirm ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await deleteGoal(goal.id);
                onDeleted();
              }}
              className="flex-1 rounded-2xl bg-orange px-4 py-3 text-sm font-bold text-white active:scale-95"
            >
              Delete goal
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="flex-1 rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-ink active:bg-white/10"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-muted active:bg-white/10"
          >
            Delete goal
          </button>
        )}
      </div>
    </>
  );
}

/** A sentence about whether the current pace reaches the target. */
function insight(goal: Goal, p: GoalProgress): string {
  if (p.complete) return "Goal reached — nice work. 🎉";
  if (p.daysLeft === 0) {
    return `Ended at ${p.percent}% of target. Worth setting a slightly smaller one next time?`;
  }
  const remaining = p.target - p.value;
  const perDay = remaining / p.daysLeft;
  const unit = GOAL_META[goal.metric].unit;
  const elapsed = p.perDay.filter((d) => d.value > 0).length;
  if (elapsed === 0) return `Nothing logged yet — ${formatValue(goal.metric, remaining)} ${unit} to go.`;
  return `${formatValue(goal.metric, remaining)} ${unit} to go — about ${formatValue(
    goal.metric,
    perDay,
  )} ${unit} a day for the remaining ${p.daysLeft} day${p.daysLeft === 1 ? "" : "s"}.`;
}

function aboutText(metric: GoalMetric): string {
  switch (metric) {
    case "sets":
      return "Counts every set from your strength workouts, including warm-up sets. Cardio isn't counted.";
    case "hard_sets":
      return "Counts only sets you marked HARD while logging — the ones taken to or near failure.";
    case "frequency":
      return "Counts each distinct day you logged a workout, no matter how much you did.";
    case "cardio_time":
      return "Adds up the time recorded on cardio exercises, in minutes.";
    case "running_distance":
      return "Adds up distance from running specifically, not other cardio machines.";
  }
}

// ---------------- create / edit ----------------

function GoalForm({
  goal,
  today,
  onDone,
  onCancel,
}: {
  goal?: Goal;
  today: string;
  onDone: (saved: Goal) => void;
  onCancel: () => void;
}) {
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? "sets");
  const [target, setTarget] = useState(String(goal?.target ?? GOAL_META.sets.presets[2]));
  const [duration, setDuration] = useState<"week" | "month" | "custom">(
    goal ? "custom" : "week",
  );
  const [start, setStart] = useState(goal?.start_date ?? thisWeek(today).start);
  const [end, setEnd] = useState(goal?.end_date ?? thisWeek(today).end);
  const [name, setName] = useState(goal?.name ?? "");
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [muscleGroup, setMuscleGroup] = useState<string>(goal?.muscle_group ?? "");
  const [cardioType, setCardioType] = useState<string>(goal?.cardio_type ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const meta = GOAL_META[metric];
  const scopedByGroup = GROUP_SCOPED.includes(metric);
  const scopedByCardio = metric === "cardio_time";

  function pickDuration(d: "week" | "month" | "custom") {
    setDuration(d);
    if (d === "week") {
      const w = thisWeek(today);
      setStart(w.start);
      setEnd(w.end);
    } else if (d === "month") {
      const m = thisMonth(today);
      setStart(m.start);
      setEnd(m.end);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const mg = scopedByGroup && muscleGroup ? muscleGroup : null;
      const ct = scopedByCardio && cardioType ? cardioType : null;
      const { id } = await saveGoal({
        id: goal?.id,
        metric,
        target: Number(target) || 0,
        start_date: start,
        end_date: end,
        name,
        notes,
        muscle_group: mg,
        cardio_type: ct,
      });
      // Hand the full saved goal back so the list can show it immediately
      // rather than waiting on a refetch (or an app restart).
      onDone({
        id,
        metric,
        target: Number(target) || 0,
        start_date: start,
        end_date: end,
        name: name.trim() || null,
        notes: notes.trim() || null,
        archived: false,
        muscle_group: mg,
        cardio_type: ct,
      });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save the goal.");
      setBusy(false);
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink active:bg-white/10"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">{goal ? "Edit goal" : "Add New Goal"}</h1>
      </header>

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">1. Choose Goal Type</p>
          <div className="grid grid-cols-3 gap-2">
            {GOAL_METRICS.map((m) => {
              const mm = GOAL_META[m];
              const on = metric === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMetric(m);
                    if (!goal) setTarget(String(mm.presets[2]));
                  }}
                  aria-pressed={on}
                  className={[
                    "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                    on ? "border-green bg-green-tint" : "border-white/10 bg-surface",
                  ].join(" ")}
                >
                  <span aria-hidden className="text-lg">
                    {mm.icon}
                  </span>
                  <span className="text-xs font-bold text-ink">{mm.label}</span>
                  <span className="text-[10px] leading-tight text-muted">{mm.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">2. Set Your Target</p>
          <div className="flex items-center gap-2">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              type="number"
              inputMode="decimal"
              min={1}
              className={INPUT}
            />
            <span className="shrink-0 text-sm text-muted">{meta.unit}</span>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {meta.presets.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTarget(String(v))}
                className={[
                  "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                  Number(target) === v
                    ? "border-green text-green"
                    : "border-white/10 text-muted",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {scopedByGroup && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Muscle group</p>
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              className={INPUT}
            >
              <option value="">All muscle groups</option>
              {SCOPE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {MUSCLE_GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
        )}

        {scopedByCardio && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Cardio type</p>
            <select
              value={cardioType}
              onChange={(e) => setCardioType(e.target.value)}
              className={INPUT}
            >
              <option value="">All cardio</option>
              {CARDIO_TYPES.map((c) => (
                <option key={c} value={c}>
                  {CARDIO_TYPE_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">3. Duration</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["week", "This Week"],
              ["month", "This Month"],
              ["custom", "Custom"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => pickDuration(key)}
                className={[
                  "rounded-xl border px-2 py-2.5 text-xs font-semibold transition",
                  duration === key ? "border-green text-green" : "border-white/10 text-muted",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          {duration === "custom" && (
            <div className="mt-2 flex gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs text-muted">Start</span>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={INPUT}
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs text-muted">End</span>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={INPUT}
                />
              </label>
            </div>
          )}
          {duration !== "custom" && (
            <p className="mt-1.5 text-xs text-muted">
              {formatShortDate(start)} – {formatShortDate(end)}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">4. Goal Name (Optional)</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder={`Weekly ${meta.label} Goal`}
            className={INPUT}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">5. Notes (Optional)</p>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 100))}
            placeholder="Add a note to remind yourself…"
            className={INPUT}
          />
        </div>

        {error && <p className="text-sm text-orange">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="w-full rounded-2xl bg-green px-4 py-3.5 text-base font-bold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : goal ? "Save changes" : "Create Goal"}
        </button>
      </div>
    </>
  );
}

// ---------------- shared bits ----------------

function Ring({
  percent,
  size = 96,
  tone = "#A8E830",
}: {
  percent: number;
  size?: number;
  tone?: string;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2D24" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, percent)) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold leading-none text-ink" style={{ fontSize: size / 4.5 }}>
          {percent}%
        </span>
        <span className="mt-0.5 text-[9px] text-muted">Overall</span>
      </div>
    </div>
  );
}

function EmptyGoals({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
      <p className="text-3xl" aria-hidden>
        🎯
      </p>
      <p className="mt-3 font-semibold text-ink">No goals yet</p>
      <p className="mt-1 text-sm text-muted">
        Set a target and it fills in automatically from the workouts you log.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-5 rounded-2xl bg-green px-5 py-3 text-sm font-bold text-ink-inverse active:scale-95"
      >
        + Add New Goal
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}
