export default function StatsLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <div className="h-7 w-24 animate-pulse rounded bg-black/10" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-black/5" />
      </header>
      <div className="mt-4 h-10 animate-pulse rounded-xl bg-black/[0.06]" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-beige" />
        ))}
      </div>
      <div className="mt-4 h-20 animate-pulse rounded-xl bg-black/[0.04]" />
      <div className="mt-4 h-32 animate-pulse rounded-xl bg-white" />
      <div className="mt-4 h-32 animate-pulse rounded-xl bg-white" />
    </main>
  );
}
