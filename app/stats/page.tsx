export default function StatsPage() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <h1 className="text-2xl font-bold tracking-tight">Stats</h1>
        <p className="mt-0.5 text-sm text-muted">
          Your training insights and progress charts.
        </p>
      </header>

      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 px-6 py-16 text-center">
        <span aria-hidden className="text-4xl">📈</span>
        <p className="mt-3 text-base font-semibold text-ink">Insights coming soon</p>
        <p className="mt-1 text-sm text-muted">
          Volume trends, PR progression, measurement &amp; cardio charts are on
          the way.
        </p>
      </div>
    </main>
  );
}
