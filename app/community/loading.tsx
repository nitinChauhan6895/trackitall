export default function CommunityLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="pb-1 pt-5">
        <div className="h-7 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-white/10" />
      </header>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 h-28 animate-pulse rounded-2xl bg-surface" />
      ))}
    </main>
  );
}
