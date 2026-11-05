export default function StatsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="flex items-center justify-between px-1 pt-5">
        <div className="space-y-2">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-32 animate-pulse rounded-full bg-white/10" />
      </header>
      <div className="h-[190px] animate-pulse rounded-[28px] bg-surface" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-[136px] animate-pulse rounded-3xl bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[28px] bg-surface" />
    </main>
  );
}
