"use client";

import { formatShortDate } from "@/lib/dateFormat";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllPrs, qk } from "@/lib/browserData";
import {
  formatPrValue,
  formatSeconds,
  parseTimeToSeconds,
  prIcon,
  type Pr,
  type PrUnitType,
} from "@/lib/types";
import { groupPrs, type PrGroup } from "@/lib/prGroups";
import { toDateKey } from "@/lib/date";
import { deletePr, savePr } from "@/app/actions";
import { Sparkline } from "@/components/Sparkline";

// Locale-independent so the server-rendered HTML matches every device
// (see lib/dateFormat.ts).
const fmtDate = formatShortDate;

function isRecent(dateKey: string | null, days = 21): boolean {
  if (!dateKey) return false;
  const [y, m, d] = dateKey.split("-").map(Number);
  return Date.now() - Date.UTC(y, m - 1, d) <= days * 86400000;
}

// Signed improvement label for the latest attempt vs the previous best.
// Improvement is green; regression is muted.
function deltaLabel(g: PrGroup): { text: string; good: boolean } | null {
  if (g.delta == null || g.delta === 0) return null;
  const unit = g.best.unit_type;
  const good = unit === "time" ? g.delta < 0 : g.delta > 0;
  const abs = Math.abs(g.delta);
  const amount =
    unit === "time"
      ? formatSeconds(abs)
      : `${Math.round(abs * 100) / 100} ${unit === "kg" ? "kg" : g.best.distance_unit ?? "m"}`;
  return { text: `${g.delta > 0 ? "+" : "−"}${amount}`, good };
}

const UNIT_OPTIONS: { value: PrUnitType; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "time", label: "time (mm:ss)" },
  { value: "distance", label: "distance" },
];

type Preset = { name: string; unit: PrUnitType; distance_unit: "m" | "km" | null };

export default function PrManager({ initialPrs }: { initialPrs: Pr[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Pr | null>(null);
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(null);

  // Cache-backed: instant from IndexedDB on revisit, refreshed in the
  // background; saves/deletes invalidate this key.
  const { data: prs = initialPrs } = useQuery({
    queryKey: qk.prs(),
    queryFn: fetchAllPrs,
    initialData: initialPrs,
  });
  const groups = groupPrs(prs);

  function done() {
    setEditing(null);
    setAdding(false);
    setPreset(null);
    queryClient.invalidateQueries({ queryKey: qk.prs() });
  }

  return (
    <main className="flex flex-1 flex-col px-4 pb-16 safe-top">
      <header className="flex items-center gap-3 py-4">
        <Link
          href="/"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-white/10"
        >
          ←
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden>🏆</span> PR corner
        </h1>
      </header>

      {editing || adding ? (
        <PrForm
          key={editing?.id ?? preset?.name ?? "new"}
          editing={editing}
          preset={preset}
          onDone={done}
          onCancel={() => {
            setEditing(null);
            setAdding(false);
            setPreset(null);
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-4 w-full rounded-2xl bg-orange px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            + Add PR
          </button>

          {groups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-muted">
              No PRs yet. Add your personal bests above.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <PrGroupCard
                  key={g.key}
                  g={g}
                  onEditEntry={(pr) => setEditing(pr)}
                  onAddEntry={() => {
                    setPreset({
                      name: g.best.exercise_name,
                      unit: g.best.unit_type,
                      distance_unit: g.best.distance_unit,
                    });
                    setAdding(true);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

// One exercise = one card. Collapsed: current PR. Expanded: progress chart
// + full attempt history (tap an attempt to edit/delete it).
function PrGroupCard({
  g,
  onEditEntry,
  onAddEntry,
}: {
  g: PrGroup;
  onEditEntry: (pr: Pr) => void;
  onAddEntry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const best = g.best;
  const delta = deltaLabel(g);
  const showNew = g.isNewPr && isRecent(g.latest.achieved_date);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.04]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-lg">
          {prIcon(best)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">
              {best.exercise_name}
            </span>
            {showNew && (
              <span className="shrink-0 rounded-md bg-orange px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                New PR
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-green">
              {formatPrValue(best)}
            </span>
            {best.reps != null && (
              <span className="text-sm font-semibold text-muted">× {best.reps}</span>
            )}
            {delta && (
              <span
                className={`text-xs font-semibold ${delta.good ? "text-green" : "text-muted"}`}
              >
                {delta.text} last
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-medium text-muted">
            {g.entries.length} {g.entries.length === 1 ? "entry" : "entries"}
          </span>
          <span aria-hidden className="text-muted">
            {open ? "⌃" : "⌄"}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">
          {g.series.length >= 2 && (
            <div className="mb-3 h-16 w-full text-green">
              <Sparkline values={g.series} className="h-full w-full" />
            </div>
          )}

          <ul className="space-y-1">
            {[...g.entries].reverse().map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onEditEntry(e)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left active:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {e.achieved_date ? fmtDate(e.achieved_date) : "No date"}
                    {e.id === best.id && (
                      <span aria-hidden title="Personal record">
                        🏆
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      e.id === best.id ? "text-green" : "text-ink"
                    }`}
                  >
                    {formatPrValue(e)}
                    {e.reps != null ? ` × ${e.reps}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onAddEntry}
            className="mt-2 text-sm font-semibold text-green active:opacity-70"
          >
            + Log new attempt
          </button>
        </div>
      )}
    </div>
  );
}

function PrForm({
  editing,
  preset,
  onDone,
  onCancel,
}: {
  editing: Pr | null;
  preset: Preset | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.exercise_name ?? preset?.name ?? "");
  const [unit, setUnit] = useState<PrUnitType>(
    editing?.unit_type ?? preset?.unit ?? "kg",
  );
  const [distanceUnit, setDistanceUnit] = useState<"m" | "km">(
    editing?.distance_unit ?? preset?.distance_unit ?? "m",
  );
  const [value, setValue] = useState(() => {
    if (!editing) return "";
    if (editing.unit_type === "time") return formatSeconds(editing.value);
    return String(editing.value);
  });
  const [reps, setReps] = useState(
    editing?.reps != null ? String(editing.reps) : "",
  );
  const [date, setDate] = useState(
    editing?.achieved_date ?? toDateKey(new Date()),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter an exercise name.");
      return;
    }

    let numeric: number | null;
    if (unit === "time") {
      numeric = parseTimeToSeconds(value);
      if (numeric == null) {
        setError("Enter time as mm:ss (e.g. 28:40).");
        return;
      }
    } else {
      numeric = value.trim() === "" ? null : Number(value);
      if (numeric == null || !Number.isFinite(numeric) || numeric < 0) {
        setError("Enter a valid value.");
        return;
      }
    }

    const repsNum = unit === "kg" && reps.trim() !== "" ? Number(reps) : null;
    if (repsNum != null && (!Number.isFinite(repsNum) || repsNum < 0)) {
      setError("Enter valid reps.");
      return;
    }

    setBusy(true);
    try {
      await savePr({
        id: editing?.id,
        exercise_name: name,
        unit_type: unit,
        value: numeric,
        distance_unit: unit === "distance" ? distanceUnit : null,
        reps: repsNum,
        achieved_date: date,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not save PR.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await deletePr(editing.id);
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Could not delete PR.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="mb-2 text-sm font-semibold text-muted">
        {editing ? "Edit entry" : preset ? `New attempt · ${preset.name}` : "Add a new PR"}
      </h2>

      <div className="space-y-2.5">
        <div>
          <label className="mb-1 block text-sm text-muted">Date achieved</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none focus:border-orange"
          />
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Exercise name"
          className="w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange"
        />

        <div className="flex gap-2.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={unit === "time" ? "text" : "decimal"}
            placeholder={unit === "time" ? "mm:ss" : "Value"}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange"
          />
          {unit === "kg" && (
            <input
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              inputMode="numeric"
              placeholder="Reps"
              className="w-20 shrink-0 rounded-xl border border-white/10 bg-surface px-3 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-orange"
            />
          )}
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as PrUnitType)}
            className="shrink-0 rounded-xl border border-white/10 bg-surface px-3 py-3 text-base text-ink outline-none focus:border-orange"
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {unit === "kg" && (
          <p className="text-xs text-muted">Reps optional (e.g. 120 kg × 5).</p>
        )}

        {unit === "distance" && (
          <div className="flex gap-2">
            {(["m", "km"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDistanceUnit(u)}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-medium",
                  distanceUnit === u
                    ? "bg-orange text-white"
                    : "border border-white/10 bg-surface text-ink",
                ].join(" ")}
              >
                {u}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-orange">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-orange px-4 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : editing ? "Update entry" : "Save PR"}
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted active:bg-white/10"
          >
            Cancel
          </button>
          {editing && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-orange active:bg-orange-soft"
            >
              Delete entry
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
