"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchPrSources, qk } from "@/lib/browserData";
import { toDateKey } from "@/lib/date";
import { formatShortDate } from "@/lib/dateFormat";
import {
  computePrs,
  formatPrDelta,
  formatPrValue,
  prMetricLabel,
  type PrRecord,
  type PrSourceRow,
} from "@/lib/prs";
import PrTile, { PrIcon } from "@/components/PrTile";

type Filter = "all" | "weights" | "cardio";

const GLASS_BACK =
  "elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15";

/**
 * PR corner, fully automatic: every record comes from the workout log, so it
 * updates itself whenever a workout is saved or edited.
 */
export default function PrCorner({ initialSources }: { initialSources: PrSourceRow[] }) {
  const { data: sources = initialSources } = useQuery({
    queryKey: qk.prSources(),
    queryFn: fetchPrSources,
    initialData: initialSources,
  });
  const [filter, setFilter] = useState<Filter>("all");

  const { records, events } = computePrs(sources);
  const thisMonth = toDateKey(new Date()).slice(0, 7);
  const beatenThisMonth = events.filter((e) => e.date.startsWith(thisMonth)).length;
  const weights = records.filter((r) => r.metric === "weight");
  const top = weights.length ? weights.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const shown = records.filter((r) =>
    filter === "all" ? true : filter === "weights" ? r.metric === "weight" : r.metric !== "weight",
  );
  const recent = events.slice(0, 10);

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <Link href="/" aria-label="Back" className={GLASS_BACK}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">PR corner</h1>
          <span className="text-[13px] text-muted">Updated automatically from your workouts</span>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="rounded-[28px] border border-dashed border-white/15 px-5 py-10 text-center text-sm leading-[1.5] text-muted">
          No records yet. Log workouts with weights or cardio, and your bests show up here on their own.
        </p>
      ) : (
        <>
          <section className="elevation-1 flex flex-col gap-[18px] rounded-[28px] px-5 pb-5 pt-[22px]">
            {top && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-[0.08em] text-muted">TOP LIFT</span>
                <span className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
                  {formatPrValue("weight", top.value).replace(" kg", "")}
                  <span className="text-xl font-semibold text-green"> kg</span>
                  {top.reps ? <span className="text-[22px] font-semibold text-muted"> × {top.reps}</span> : null}
                </span>
                <span className="truncate text-[15px] text-[#D4D4D4]">{top.name}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat value={records.length} label={records.length === 1 ? "Record" : "Records"} />
              <MiniStat value={beatenThisMonth} label="New this month" green />
              <MiniStat value={events.length} label="Times beaten" />
            </div>
          </section>

          {recent.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="font-display text-xl font-semibold">Recent PRs</h2>
                <span className="text-xs text-muted">newest first</span>
              </div>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {recent.map((e) => (
                  <PrTile
                    key={`${e.key}|${e.date}`}
                    name={e.name}
                    metric={e.metric}
                    value={e.value}
                    delta={e.delta}
                    reps={e.reps}
                    href={`/day/${e.date}`}
                    className="w-[210px] shrink-0 snap-start"
                  />
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="font-display text-xl font-semibold">All records</h2>
              <div role="radiogroup" aria-label="Filter records" className="flex gap-1.5">
                {(["all", "weights", "cardio"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={filter === f}
                    onClick={() => setFilter(f)}
                    className={[
                      "h-9 rounded-full px-3 text-[13px] capitalize transition",
                      filter === f ? "bg-ink font-semibold text-ink-inverse" : "elevation-1 font-medium text-[#D4D4D4]",
                    ].join(" ")}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            {shown.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-muted">
                No {filter === "cardio" ? "cardio" : "weight"} records yet.
              </p>
            ) : (
              <div className="elevation-1 flex flex-col rounded-3xl">
                {shown.map((r) => (
                  <RecordRow key={r.key} r={r} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function RecordRow({ r }: { r: PrRecord }) {
  return (
    <Link
      href={`/day/${r.date}`}
      className="relative flex items-center gap-3 border-b border-surface-2 px-4 py-3 last:border-0 active:bg-white/[0.04]"
    >
      <PrIcon metric={r.metric} size={36} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{r.name}</span>
        <span className="truncate text-xs text-muted">
          {prMetricLabel(r.metric)} · {formatShortDate(r.date)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-display text-lg font-semibold">
          {formatPrValue(r.metric, r.value)}
          {r.metric === "weight" && r.reps ? <span className="text-[13px] font-normal text-muted"> × {r.reps}</span> : null}
        </span>
        {r.delta != null && r.delta > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-green/[0.12] px-2 py-0.5 text-[11px] font-semibold text-green">
            <svg width="7" height="7" viewBox="0 0 10 10" aria-hidden>
              <path d="M5 1l4 7H1z" fill="currentColor" />
            </svg>
            <span className="sr-only">up </span>
            {formatPrDelta(r.metric, r.delta)}
          </span>
        )}
      </span>
    </Link>
  );
}

function MiniStat({ value, label, green }: { value: number; label: string; green?: boolean }) {
  return (
    <div className="elevation-2 flex flex-col gap-0.5 rounded-2xl px-3.5 py-3">
      <span className={`font-display text-[22px] font-semibold ${green ? "text-green" : ""}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
