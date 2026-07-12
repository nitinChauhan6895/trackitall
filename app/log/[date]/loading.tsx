export default function LogLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-32 safe-top">
      <header className="flex items-center gap-3 py-4">
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
        </div>
      </header>
      <div className="mt-6 h-56 animate-pulse rounded-3xl bg-surface" />
    </main>
  );
}
