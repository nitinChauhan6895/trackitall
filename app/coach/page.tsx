"use client";

import { useState } from "react";

type Tab = "exercise" | "diet";

export default function CoachPage() {
  const [tab, setTab] = useState<Tab>("exercise");

  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span aria-hidden>🧠</span> Coach
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Your personal training &amp; nutrition guide
        </p>
      </header>

      {/* Exercise / Diet toggle */}
      <div className="mt-4 flex rounded-xl bg-black/[0.05] p-1">
        {(["exercise", "diet"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition",
              tab === t ? "bg-white text-green shadow-sm" : "text-muted",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "exercise" ? <ExerciseTab /> : <DietTab />}
    </main>
  );
}

function SoonPill() {
  return (
    <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange">
      Soon
    </span>
  );
}

function ExerciseTab() {
  return (
    <div className="mt-5 space-y-5">
      {/* Design workout hero */}
      <section className="rounded-2xl border border-black/5 bg-white p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-tint text-2xl">
          🏋️
        </div>
        <h2 className="mt-3 text-base font-bold text-ink">
          Design your own workout
        </h2>
        <p className="mt-1 text-sm text-muted">
          Build a custom routine, save it to your library, and drop it into any
          day&apos;s log in one tap.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-3 text-base font-semibold text-white opacity-60"
        >
          + Design a workout <SoonPill />
        </button>
      </section>

      {/* Saved workouts */}
      <div>
        <h3 className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
          Saved workouts
        </h3>
        <div className="rounded-2xl border border-dashed border-black/15 px-4 py-10 text-center">
          <span aria-hidden className="text-3xl">📋</span>
          <p className="mt-2 text-sm font-medium text-ink">No saved workouts yet</p>
          <p className="mt-1 text-xs text-muted">
            Design a routine and it&apos;ll show up here to reuse and add to any day.
          </p>
        </div>
      </div>
    </div>
  );
}

function DietTab() {
  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-black/5 bg-white p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-tint text-2xl">
          🥗
        </div>
        <h2 className="mt-3 flex items-center gap-2 text-base font-bold text-ink">
          Personalised diet plans <SoonPill />
        </h2>
        <p className="mt-1 text-sm text-muted">
          Daily calorie &amp; macro targets and meal suggestions tailored to your
          goals and training load.
        </p>
      </section>

      <div className="rounded-2xl border border-dashed border-black/15 px-4 py-10 text-center">
        <span aria-hidden className="text-3xl">🍽️</span>
        <p className="mt-2 text-sm font-medium text-ink">Nothing here yet</p>
        <p className="mt-1 text-xs text-muted">
          Your diet plan and food log will live here.
        </p>
      </div>
    </div>
  );
}
