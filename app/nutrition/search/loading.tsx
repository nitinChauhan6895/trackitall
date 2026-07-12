export default function SearchLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-6 safe-top">
      <header className="flex items-center gap-3 py-4">
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
        <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
      </header>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
      <div className="mb-3 h-12 animate-pulse rounded-2xl bg-surface" />
      <div className="mb-3 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-surface" />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="mb-2 h-16 animate-pulse rounded-xl bg-surface" />
      ))}
    </main>
  );
}
