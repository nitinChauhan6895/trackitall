export default function CoachLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <div className="h-7 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-3 w-56 animate-pulse rounded bg-white/10" />
      </header>
      <div className="mt-4 h-12 animate-pulse rounded-2xl bg-surface" />
      <div className="mt-4 h-40 animate-pulse rounded-2xl bg-surface" />
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-surface" />
    </main>
  );
}
