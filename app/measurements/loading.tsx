export default function MeasurementsLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center gap-3 py-4">
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
      </header>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-green-tint" />
        ))}
      </div>
      <div className="mb-4 h-12 animate-pulse rounded-2xl bg-white/10" />
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    </main>
  );
}
