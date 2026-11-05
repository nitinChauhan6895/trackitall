export default function BadgesLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-white/10" />
      </div>
      <div className="h-[220px] animate-pulse rounded-[28px] bg-surface" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[170px] animate-pulse rounded-3xl bg-surface" />
        ))}
      </div>
    </main>
  );
}
