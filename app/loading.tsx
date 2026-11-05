// Instant shell shown while Home's server data (profile, stats, calendar, PRs,
// measurements) is fetched. Next renders this immediately on navigation, so
// returning Home paints right away instead of blocking on the data queries.
export default function HomeLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="flex items-center justify-between px-1 pt-5">
        <div className="space-y-2">
          <div className="h-8 w-36 animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
      </header>

      <div className="h-[290px] animate-pulse rounded-[28px] bg-surface" />

      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-3xl bg-surface" />
        ))}
      </div>

      <div className="h-80 animate-pulse rounded-[28px] bg-surface" />
    </main>
  );
}
