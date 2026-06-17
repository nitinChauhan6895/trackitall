export default function BadgesLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center gap-3 py-4">
        <div className="h-9 w-9 animate-pulse rounded-full bg-black/10" />
        <div className="h-5 w-28 animate-pulse rounded bg-black/10" />
      </header>
      <div className="mb-5 h-4 w-24 animate-pulse rounded bg-black/5" />
      <div className="grid grid-cols-3 gap-x-3 gap-y-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
    </main>
  );
}
