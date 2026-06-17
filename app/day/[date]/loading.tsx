export default function DayLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center gap-3 py-4">
        <div className="h-9 w-9 animate-pulse rounded-full bg-black/10" />
        <div className="space-y-2">
          <div className="h-5 w-48 animate-pulse rounded bg-black/10" />
          <div className="h-3 w-28 animate-pulse rounded bg-black/5" />
        </div>
      </header>
      <div className="mb-4 h-20 animate-pulse rounded-2xl bg-white" />
      {[0, 1].map((i) => (
        <div key={i} className="mb-4 h-40 animate-pulse rounded-2xl bg-white" />
      ))}
    </main>
  );
}
