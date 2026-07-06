"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatSeconds,
  parseTimeToSeconds,
  type Circuit,
} from "@/lib/types";
import { resolveHiitMetrics } from "@/lib/hiit";
import {
  CIRCUIT_FILTERS,
  categoryFor,
  circuitLibrary,
  summarizeCircuitExercise,
  type CircuitCategory,
} from "@/lib/circuits";
import { saveCircuit } from "@/app/actions";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type DraftEx = {
  key: string;
  name: string;
  category: CircuitCategory;
  metrics: Record<string, string>;
  expanded: boolean;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-green";

export default function CircuitBuilder({ initial }: { initial?: Circuit }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [exercises, setExercises] = useState<DraftEx[]>(
    (initial?.exercises ?? []).map((e) => ({
      key: uid(),
      name: e.name,
      category: (e.category as CircuitCategory) ?? categoryFor(e.name),
      metrics: Object.fromEntries(
        Object.entries(e.metrics ?? {}).map(([k, v]) => [k, String(v)]),
      ),
      expanded: false,
    })),
  );
  const [setTimes, setSetTimes] = useState<string[]>(
    (initial?.set_times ?? []).map((s) => formatSeconds(s)),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patchEx(key: string, patch: Partial<DraftEx>) {
    setExercises((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    );
  }

  function addExercise(exName: string) {
    setExercises((prev) => [
      ...prev,
      {
        key: uid(),
        name: exName,
        category: categoryFor(exName),
        metrics: {},
        expanded: true,
      },
    ]);
    setSheetOpen(false);
  }

  async function save() {
    setError("");
    if (!name.trim()) {
      setError("Give your circuit a name.");
      return;
    }
    if (exercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }
    setBusy(true);
    try {
      await saveCircuit({
        id: initial?.id,
        name,
        set_times: setTimes
          .map((t) => parseTimeToSeconds(t))
          .filter((s): s is number => s != null && s > 0),
        exercises: exercises.map((e) => ({
          name: e.name,
          category: e.category,
          metrics: e.metrics,
        })),
      });
      router.push("/circuits");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Could not save circuit.");
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center justify-between py-4">
        <button
          type="button"
          onClick={() => router.push("/circuits")}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-white/10"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold">
          {initial ? "Edit Circuit" : "Create Circuit"}
        </h1>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="text-base font-semibold text-green active:opacity-70 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </header>

      {/* 1. Circuit name */}
      <Section step="1" title="Circuit name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning Burner"
          className={inputClass}
        />
      </Section>

      {/* 2. Exercises */}
      <Section
        step="2"
        title="Add exercises"
        aside={`${exercises.length} exercise${exercises.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-2">
          {exercises.map((ex, i) => (
            <div
              key={ex.key}
              className="rounded-2xl border border-white/10 bg-surface"
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <span className="w-5 text-center text-sm font-semibold text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{ex.name}</p>
                  <p className="truncate text-sm text-muted">
                    {summarizeCircuitExercise(ex.name, ex.metrics)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => patchEx(ex.key, { expanded: !ex.expanded })}
                  aria-label="Edit targets"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-orange active:bg-white/10"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExercises((prev) => prev.filter((e) => e.key !== ex.key))
                  }
                  aria-label="Remove exercise"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-white/10"
                >
                  ✕
                </button>
              </div>
              {ex.expanded && (
                <div className="border-t border-white/10 p-3">
                  <MetricInputs
                    name={ex.name}
                    metrics={ex.metrics}
                    onChange={(metrics) => patchEx(ex.key, { metrics })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-green/50 px-4 py-3 text-sm font-semibold text-green active:bg-green-tint"
        >
          + Add Exercise
        </button>
      </Section>

      {/* 3. Set times */}
      <Section step="3" title="Set times">
        <p className="mb-2 -mt-1 text-sm text-muted">
          Add a time for each round of this circuit.
        </p>
        <div className="space-y-2">
          {setTimes.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-sm font-medium text-muted">
                Set {i + 1}
              </span>
              <input
                value={t}
                onChange={(e) =>
                  setSetTimes((prev) =>
                    prev.map((x, j) => (j === i ? e.target.value : x)),
                  )
                }
                placeholder="mm:ss"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  setSetTimes((prev) => prev.filter((_, j) => j !== i))
                }
                aria-label="Remove set"
                className="shrink-0 px-1 text-muted active:text-orange"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSetTimes((prev) => [...prev, ""])}
          className="mt-2 text-sm font-semibold text-green active:opacity-70"
        >
          + Add Set
        </button>
      </Section>

      {error && <p className="mt-3 text-sm text-orange">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-4 pb-5 pt-2 safe-bottom">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex w-full items-center justify-center rounded-2xl bg-green px-4 py-4 text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Circuit"}
        </button>
      </div>

      {sheetOpen && (
        <AddExerciseSheet
          onAdd={addExercise}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  );
}

function Section({
  step,
  title,
  aside,
  children,
}: {
  step: string;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {step}. {title}
        </h2>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function MetricInputs({
  name,
  metrics,
  onChange,
}: {
  name: string;
  metrics: Record<string, string>;
  onChange: (m: Record<string, string>) => void;
}) {
  const resolved = resolveHiitMetrics(name);
  if (resolved.length === 0) {
    return <p className="text-sm text-muted">No preset targets for this exercise.</p>;
  }
  return (
    <div className="space-y-2">
      {resolved.map((m) => {
        const isTime = m.kind === "time";
        return (
          <div key={m.draftKey}>
            <label className="mb-1 block text-sm font-medium text-ink">
              {m.label}
            </label>
            <div className="relative">
              <input
                value={metrics[m.draftKey] ?? ""}
                onChange={(e) =>
                  onChange({ ...metrics, [m.draftKey]: e.target.value })
                }
                type={isTime ? "text" : "number"}
                inputMode={isTime ? "text" : "decimal"}
                min={isTime ? undefined : 0}
                placeholder={isTime ? "mm:ss" : "0"}
                className={`${inputClass} ${m.unit ? "pr-12" : ""}`}
              />
              {m.unit && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  {m.unit}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddExerciseSheet({
  onAdd,
  onClose,
}: {
  onAdd: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CircuitCategory>("all");
  const [manual, setManual] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return circuitLibrary().filter(
      (it) =>
        (filter === "all" || it.category === filter) &&
        (q === "" || it.name.toLowerCase().includes(q)),
    );
  }, [query, filter]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Add exercise"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-page p-4 shadow-xl safe-bottom"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Add Exercise</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-white/10"
          >
            ✕
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          className={`${inputClass} mb-3`}
        />

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {CIRCUIT_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={[
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                filter === f.key
                  ? "bg-green text-ink-inverse"
                  : "border border-white/10 bg-surface text-ink",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="flex-1 space-y-2 overflow-y-auto">
          {items.map((it) => (
            <li key={it.name}>
              <button
                type="button"
                onClick={() => onAdd(it.name)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-surface px-4 py-3 text-left active:bg-white/10"
              >
                <span>
                  <span className="block font-medium text-ink">{it.name}</span>
                  <span className="block text-xs text-muted">
                    {it.metrics.map((m) => m.label).join(" · ") || "Manual"}
                  </span>
                </span>
                <span className="text-green">+</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Enter exercise manually"
              className={inputClass}
            />
            <button
              type="button"
              disabled={!manual.trim()}
              onClick={() => {
                onAdd(manual.trim());
                setManual("");
              }}
              className="shrink-0 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-ink-inverse disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
