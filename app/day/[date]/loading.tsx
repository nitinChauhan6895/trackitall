export default function DayLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <div className="flex items-center gap-2 pt-4">
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
        <div className="flex-1" />
        <div className="h-11 w-[89px] animate-pulse rounded-full bg-white/10" />
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="space-y-2 px-1">
        <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
        <div className="h-8 w-52 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
      </div>
      <div className="h-[190px] animate-pulse rounded-[28px] bg-surface" />
      {[0, 1].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-[28px] bg-surface" />
      ))}
    </main>
  );
}
