// Instant shell shown while Home's server data (profile, stats, calendar, PRs,
// measurements) is fetched. Next renders this immediately on navigation, so
// returning Home paints right away instead of blocking on the data queries.
export default function HomeLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-start justify-between pb-1 pt-5">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-black/10" />
          <div className="h-4 w-32 animate-pulse rounded bg-black/5" />
        </div>
        <div className="h-11 w-11 animate-pulse rounded-full bg-black/10" />
      </header>

      <div className="mt-3 h-12 animate-pulse rounded-2xl bg-beige" />

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-beige" />
        ))}
      </div>

      <div className="mt-4 h-72 animate-pulse rounded-2xl bg-white" />

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-2xl bg-orange-soft"
          />
        ))}
      </div>
    </main>
  );
}
