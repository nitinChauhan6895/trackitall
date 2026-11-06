export default function CommunityLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="space-y-2 px-1 pt-5">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-64 animate-pulse rounded bg-white/10" />
      </header>
      <div className="h-[76px] animate-pulse rounded-3xl bg-surface" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-3xl bg-surface" />
      ))}
    </main>
  );
}
