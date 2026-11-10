"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadGoalsAction, saveGoal, deleteGoal } from "@/app/actions";
import { qk } from "@/lib/browserData";
import { refetchUnlessJustFetched, useSeedQuery } from "@/lib/seed";
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

// Groups offered for a scoped goal — cardio/HIIT aren't "sets" work.
const SCOPE_GROUPS = MUSCLE_GROUPS.filter((g) => g !== "cardio" && g !== "hiit");

const INPUT =
  "w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-green";

type Tab = "overview" | "active" | "history";
type View =
  | { name: "list" }
  | { name: "detail"; id: string }
  | { name: "new"; id?: undefined; metric?: GoalMetric }
  | { name: "edit"; id: string };

export type GoalsData = { goals: Goal[]; exercises: GoalExercise[] };

export default function GoalsClient({
  initial,
  fetchedAt,
  todayKey,
}: {
  initial: GoalsData;
  /** When the server fetched `initial` (ms). */
  fetchedAt: number;
  /** The SERVER's date — seeding from it keeps SSR and first client render
   *  identical; the device's real date is applied on mount. */
  todayKey: string;
}) {
  const queryClient = useQueryClient();
  useSeedQuery(qk.goals(), initial, fetchedAt);
  const { data } = useQuery({
    queryKey: qk.goals(),
    refetchOnMount: refetchUnlessJustFetched,
    // Wrapped so React Query's context object isn't sent to the server action
    // (it can't be serialised, and the refetch would silently fail).
    queryFn: () => loadGoalsAction(),
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
      // A full-screen layer over the tab bar: the form has its own sticky
      // action where the bar would be.
      <main className="fixed inset-0 z-40 mx-auto flex w-full max-w-md flex-col overflow-y-auto bg-page px-4 pb-36 safe-top">
        <GoalForm
          goal={view.id ? goals.find((g) => g.id === view.id) : undefined}
          initialMetric={view.name === "new" ? view.metric : undefined}
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
      <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
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
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="flex flex-col gap-1 px-1 pt-5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">Goals</h1>
        <p className="text-sm text-muted">Track your progress. Stay consistent.</p>
      </header>

      <div role="tablist" aria-label="Goals view" className="elevation-1 grid grid-cols-3 gap-1 rounded-[18px] p-1">
        {(["overview", "active", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={[
              "h-11 rounded-[14px] text-sm capitalize transition",
              tab === t ? "bg-[#3A3A3A] font-semibold text-ink" : "font-medium text-muted",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview
          goals={active}
          progressOf={progressOf}
          onOpen={(id) => setView({ name: "detail", id })}
          onNew={(metric) => setView({ name: "new", metric })}
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
  onOpen,
  onNew,
}: {
  goals: Goal[];
  progressOf: (g: Goal) => GoalProgress;
  onOpen: (id: string) => void;
  onNew: (metric?: GoalMetric) => void;
}) {
  // The headline averages the active goals — one number for "am I on
  // track", rather than making you read five bars.
  const overall =
    goals.length === 0
      ? 0
      : Math.round((goals.reduce((n, g) => n + progressOf(g).ratio, 0) / goals.length) * 100);
  const done = goals.filter((g) => progressOf(g).complete).length;
  return (
    <>
      <section className="elevation-1 flex flex-col gap-5 rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">TODAY&rsquo;S PROGRESS</span>
            <span className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
              {overall}
              <span className="text-2xl text-subtle">%</span>
            </span>
            <span className="text-[15px] text-[#D4D4D4]">
              {goals.length === 0
                ? "No active goals yet"
                : `${done} of ${goals.length} active ${goals.length === 1 ? "goal" : "goals"} complete`}
            </span>
          </div>
          <Ring percent={overall} size={88} />
        </div>
        <button
          type="button"
          onClick={() => onNew()}
          className="h-[52px] rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98]"
        >
          Add new goal
        </button>
      </section>

      {goals.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Active goals" note={String(goals.length)} />
          <ul className="flex flex-col gap-3">
            {goals.map((g) => (
              <li key={g.id}>
                <GoalCard goal={g} progress={progressOf(g)} onClick={() => onOpen(g.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Start with a goal" note={`${GOAL_METRICS.length} types`} />
        <div className="elevation-1 flex flex-col rounded-3xl">
          {GOAL_METRICS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onNew(m)}
              className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-3.5 text-left last:border-0 active:bg-white/[0.04]"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold">{GOAL_META[m].label}</span>
                <span className="text-[13px] text-muted">{GOAL_META[m].blurb}</span>
              </span>
              <span className="text-sm font-semibold text-green">Set</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {groups.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={[
              "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition",
              filter === f ? "bg-green text-ink-inverse" : "elevation-2 text-muted",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyGoals onNew={onNew} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} progress={progressOf(g)} onClick={() => onOpen(g.id)} />
            </li>
          ))}
        </ul>
      )}
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
      <p className="rounded-[28px] border border-dashed border-white/15 px-4 py-10 text-center text-sm text-muted">
        Finished goals will appear here.
      </p>
    );
  }
  return (
    <div className="elevation-1 flex flex-col rounded-3xl">
      {goals.map((g) => {
        const p = progressOf(g);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onOpen(g.id)}
            className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-3.5 text-left last:border-0 active:bg-white/[0.04]"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-base font-semibold">{goalTitle(g)}</span>
              <span className="text-[13px] text-muted">
                {formatShortDate(g.start_date)} – {formatShortDate(g.end_date)}
              </span>
            </span>
            <span className={`shrink-0 font-display text-lg font-semibold ${p.complete ? "text-green" : "text-muted"}`}>
              {p.percent}%
            </span>
          </button>
        );
      })}
    </div>
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
    <button type="button" onClick={onClick} className="elevation-1 pressable flex w-full flex-col gap-3 rounded-3xl p-[18px] text-left">
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-semibold">{goalTitle(goal)}</span>
          <span className="truncate text-[13px] text-muted">{scopeLabel(goal)}</span>
        </span>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
          {progress.daysLeft === 0 ? "ended" : `${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} left`}
        </span>
      </span>
      <ProgressBar ratio={progress.ratio} />
      <span className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted">
          <span className="font-display text-base font-semibold text-ink">{formatValue(goal.metric, progress.value)}</span>{" "}
          / {formatValue(goal.metric, progress.target)} {meta.unit}
        </span>
        <span className={`font-semibold ${progress.complete ? "text-green" : "text-ink"}`}>{progress.percent}%</span>
      </span>
    </button>
  );
}

// "Sets · Legs", "Cardio time · All cardio", or the metric's description.
function scopeLabel(goal: Goal): string {
  if (goal.muscle_group) return `${GOAL_META[goal.metric].label} · ${MUSCLE_GROUP_LABELS[goal.muscle_group as keyof typeof MUSCLE_GROUP_LABELS] ?? goal.muscle_group}`;
  if (goal.cardio_type) return `${GOAL_META[goal.metric].label} · ${CARDIO_TYPE_LABELS[goal.cardio_type as keyof typeof CARDIO_TYPE_LABELS] ?? goal.cardio_type}`;
  return GOAL_META[goal.metric].blurb;
}

function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <span className="block h-2 rounded-full bg-[#2C2C2C]">
      {ratio > 0 && (
        <span className="block h-2 rounded-full bg-green transition-[width] duration-300" style={{ width: `${Math.min(1, ratio) * 100}%` }} />
      )}
    </span>
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
      <div className="flex items-center gap-3 pt-4">
        <button type="button" onClick={onBack} aria-label="Back" className={GLASS_BACK}>
          <BackArrow />
        </button>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold">Goals</span>
          <span className="truncate text-[13px] text-muted">{goalTitle(goal)}</span>
        </span>
        <button type="button" onClick={onEdit} className="elevation-3 h-11 shrink-0 rounded-full bg-white/[0.08] px-[18px] text-[15px] font-semibold text-green active:bg-white/15">
          Edit
        </button>
      </div>

      <section className="elevation-1 flex flex-col gap-5 rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">
              {formatShortDate(goal.start_date).toUpperCase()} – {formatShortDate(goal.end_date).toUpperCase()}
            </span>
            <span className="font-display text-[44px] font-bold leading-[1.05] tracking-[-0.03em]">
              {formatValue(goal.metric, progress.value)}
              <span className="text-lg font-semibold text-muted">
                {" "}/ {formatValue(goal.metric, progress.target)} {meta.unit}
              </span>
            </span>
            <span className="text-[15px] text-[#D4D4D4]">
              {progress.daysLeft === 0 ? "This goal has ended" : `${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} left`}
            </span>
          </div>
          <Ring percent={progress.percent} size={88} />
        </div>
        <p className="elevation-2 rounded-2xl px-3.5 py-3 text-sm">{insight(goal, progress)}</p>
      </section>

      <section className="elevation-1 flex flex-col gap-3 rounded-[28px] p-5">
        <h2 className="font-display text-lg font-semibold">Progress</h2>
        <div className="flex h-[140px] items-end gap-1">
          {progress.perDay.map((d, i) => {
            const future = d.date > today;
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] font-semibold text-ink/70">{d.value > 0 ? formatValue(goal.metric, d.value) : ""}</span>
                <div
                  className={`w-full rounded-t ${d.value > 0 ? "bg-green" : future ? "bg-surface-2" : "bg-[#2C2C2C]"}`}
                  style={{ height: d.value > 0 ? `${Math.max(6, (d.value / max) * 100)}%` : "2%" }}
                />
                <span className="text-[9px] text-muted">
                  {progress.perDay.length <= 7 ? DOW[i] : i % 5 === 0 ? Number(d.date.slice(8, 10)) : ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="elevation-1 flex flex-col gap-2 rounded-[28px] p-5">
        <h2 className="font-display text-lg font-semibold">About this goal</h2>
        <p className="text-sm text-muted">{aboutText(goal.metric)}</p>
        {goal.notes && <p className="text-sm text-ink">{goal.notes}</p>}
      </section>

      {confirm ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await deleteGoal(goal.id);
              onDeleted();
            }}
            className="h-12 flex-1 rounded-full bg-gold text-sm font-semibold text-ink-inverse active:scale-95"
          >
            Delete goal
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="h-12 flex-1 rounded-full border border-white/15 text-sm font-semibold text-ink active:bg-white/10">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="h-12 rounded-full border border-white/[0.14] text-sm font-semibold text-muted active:bg-white/10">
          Delete goal
        </button>
      )}
    </>
  );
}

/** A sentence about whether the current pace reaches the target. */
function insight(goal: Goal, p: GoalProgress): string {
  if (p.complete) return "Goal reached — nice work.";
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

const STEP_LABEL = "text-xs font-semibold tracking-[0.08em] text-muted";
const FIELD = "elevation-2 w-full rounded-2xl px-4 text-base text-ink outline-none placeholder:text-subtle focus:border-green/60";

function Step({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="flex items-baseline gap-2.5 px-1">
        <span className="font-display text-sm font-semibold text-green">{n}</span>
        <span className={STEP_LABEL}>{label}</span>
      </span>
      {children}
    </section>
  );
}

function GoalForm({
  goal,
  initialMetric,
  today,
  onDone,
  onCancel,
}: {
  goal?: Goal;
  /** Preselected type, e.g. from "Start with a goal". */
  initialMetric?: GoalMetric;
  today: string;
  onDone: (saved: Goal) => void;
  onCancel: () => void;
}) {
  const startMetric = goal?.metric ?? initialMetric ?? "sets";
  const [metric, setMetric] = useState<GoalMetric>(startMetric);
  const [target, setTarget] = useState(String(goal?.target ?? GOAL_META[startMetric].presets[2]));
  const [duration, setDuration] = useState<"week" | "month" | "custom">(goal ? "custom" : "week");
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

  const period = duration === "week" ? "this week" : duration === "month" ? "this month" : "";
  const actionLabel = goal
    ? "Save changes"
    : `Create goal · ${formatValue(metric, Number(target) || 0)} ${meta.unit}${period ? ` ${period}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 pt-4">
        <button type="button" onClick={onCancel} aria-label="Back" className={GLASS_BACK}>
          <BackArrow />
        </button>
        <span className="flex flex-col gap-px">
          <span className="text-[15px] font-semibold">Goals</span>
          <span className="text-[13px] text-muted">{goal ? "Edit goal" : "New goal"}</span>
        </span>
      </div>

      <h1 className="px-1 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.03em]">
        {goal ? "Edit" : "Set a"}
        <br />
        <span className="text-green">{goal ? "your goal" : "new goal"}</span>
      </h1>

      <Step n="01" label="GOAL TYPE">
        <div role="radiogroup" aria-label="Goal type" className="grid grid-cols-2 gap-2.5">
          {GOAL_METRICS.map((m, i) => {
            const mm = GOAL_META[m];
            const on = metric === m;
            const wide = i === GOAL_METRICS.length - 1;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setMetric(m);
                  if (!goal) setTarget(String(mm.presets[2]));
                }}
                className={[
                  "elevation-1 flex rounded-[20px] px-4 py-3.5 text-left",
                  wide ? "col-span-2 min-h-16 items-center justify-between" : "min-h-20 flex-col items-start justify-between",
                  on ? "!border-[1.5px] !border-green !bg-green-tint" : "",
                ].join(" ")}
              >
                <span className="font-display text-lg font-semibold">{mm.label}</span>
                <span className="text-xs text-muted">{mm.blurb}</span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n="02" label="TARGET">
        <div className="elevation-1 flex flex-col gap-4 rounded-3xl p-[18px]">
          <label className="flex items-baseline gap-2.5">
            <span className="sr-only">Target {meta.unit}</span>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              // Sized to its digits so the unit sits right after the number.
              style={{ width: `${Math.max(1, target.length) * 0.62 + 0.1}em` }}
              className="min-w-0 max-w-[60%] bg-transparent p-0 font-display text-[56px] font-bold tracking-[-0.03em] text-ink outline-none"
            />
            <span className="text-lg font-semibold text-green">{meta.unit}</span>
          </label>
          <div className="flex gap-2">
            {meta.presets.map((v) => {
              const on = Number(target) === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTarget(String(v))}
                  aria-pressed={on}
                  className={[
                    "h-11 flex-1 rounded-xl text-sm",
                    on ? "bg-green font-semibold text-ink-inverse" : "elevation-2 font-medium text-[#D4D4D4]",
                  ].join(" ")}
                >
                  {v}
                </button>
              );
            })}
          </div>
          {(scopedByGroup || scopedByCardio) && (
            <>
              <div className="h-px bg-[#2C2C2C]" />
              <label className="elevation-2 relative flex h-[52px] items-center justify-between rounded-2xl px-4">
                <span className="flex flex-col gap-px">
                  <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">
                    {scopedByGroup ? "MUSCLE GROUP" : "CARDIO TYPE"}
                  </span>
                  <span className="text-[15px]">
                    {scopedByGroup
                      ? muscleGroup
                        ? MUSCLE_GROUP_LABELS[muscleGroup as keyof typeof MUSCLE_GROUP_LABELS]
                        : "All muscle groups"
                      : cardioType
                        ? CARDIO_TYPE_LABELS[cardioType as keyof typeof CARDIO_TYPE_LABELS]
                        : "All cardio"}
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-green">Change</span>
                {/* The native picker, invisible over the row. */}
                {scopedByGroup ? (
                  <select
                    aria-label="Muscle group"
                    value={muscleGroup}
                    onChange={(e) => setMuscleGroup(e.target.value)}
                    className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                  >
                    <option value="">All muscle groups</option>
                    {SCOPE_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {MUSCLE_GROUP_LABELS[g]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    aria-label="Cardio type"
                    value={cardioType}
                    onChange={(e) => setCardioType(e.target.value)}
                    className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                  >
                    <option value="">All cardio</option>
                    {CARDIO_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {CARDIO_TYPE_LABELS[c]}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </>
          )}
        </div>
      </Step>

      <Step n="03" label="DURATION">
        <div role="radiogroup" aria-label="Duration" className="elevation-1 grid grid-cols-3 gap-1 rounded-[18px] p-1">
          {([
            ["week", "This week"],
            ["month", "This month"],
            ["custom", "Custom"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={duration === key}
              onClick={() => pickDuration(key)}
              className={[
                "h-11 rounded-[14px] text-sm transition",
                duration === key ? "bg-[#3A3A3A] font-semibold text-ink" : "font-medium text-muted",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {duration === "custom" ? (
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-xs text-muted">Start</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD + " h-[52px] [color-scheme:dark]"} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-xs text-muted">End</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD + " h-[52px] [color-scheme:dark]"} />
            </label>
          </div>
        ) : (
          <span className="px-1 text-[13px] text-muted">
            {formatShortDate(start)} – {formatShortDate(end)}
          </span>
        )}
      </Step>

      <Step n="04" label="NAME & NOTES · OPTIONAL">
        <div className="elevation-1 flex flex-col gap-2.5 rounded-3xl p-3.5">
          <label>
            <span className="sr-only">Goal name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Goal name"
              className={FIELD + " h-[52px]"}
            />
          </label>
          <label>
            <span className="sr-only">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 100))}
              placeholder="Notes"
              rows={3}
              className={FIELD + " resize-none py-3.5"}
            />
          </label>
        </div>
      </Step>

      {error && <p className="text-center text-sm text-gold">{error}</p>}

      {/* Sticky glass action */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-4 pb-7 safe-bottom">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="elevation-3 pointer-events-auto h-[60px] w-full rounded-full bg-green/[0.92] text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Saving…" : actionLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------- shared bits ----------------

const GLASS_BACK =
  "elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15";

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

// Progress ring; at 0% a single dot marks where it starts.
function Ring({ percent, size = 88 }: { percent: number; size?: number }) {
  const stroke = 9;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Progress ${p} percent`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2C2C2C" strokeWidth={stroke} />
      {p > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#22C55E"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : (
        <circle cx={size / 2} cy={size / 2 - r} r={stroke / 2} fill="#22C55E" />
      )}
    </svg>
  );
}

function EmptyGoals({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[28px] border border-dashed border-white/15 px-5 py-10 text-center">
      <p className="font-display text-lg font-semibold text-ink">No goals here yet</p>
      <p className="text-sm text-muted">Set a target and it fills in automatically from the workouts you log.</p>
      <button type="button" onClick={onNew} className="mt-3 h-11 rounded-full bg-green px-5 text-sm font-semibold text-ink-inverse active:scale-95">
        Add new goal
      </button>
    </div>
  );
}
