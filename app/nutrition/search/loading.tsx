export default function SearchLoading() {
  return (
    <main className="flex flex-1 flex-col gap-[18px] px-4 pb-12 safe-top">
      <header className="flex items-center gap-3 pt-4">
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
        <div className="h-7 w-32 animate-pulse rounded-lg bg-white/10" />
      </header>
      <div className="h-[52px] animate-pulse rounded-[18px] bg-surface" />
      <div className="h-14 animate-pulse rounded-[18px] bg-surface" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[52px] animate-pulse rounded-2xl bg-surface" />
        <div className="h-[52px] animate-pulse rounded-2xl bg-surface" />
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-surface" />
    </main>
  );
}
