export default function LogLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-12 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-20 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="space-y-2 px-1">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-white/10" />
        <div className="h-9 w-44 animate-pulse rounded-lg bg-white/10" />
      </div>
      <div className="h-14 animate-pulse rounded-[18px] bg-surface" />
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-[22px] bg-surface" />
        ))}
      </div>
    </main>
  );
}
