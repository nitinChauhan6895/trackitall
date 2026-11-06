export default function MeasurementsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <div className="flex items-center gap-3 pt-4">
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
        <div className="space-y-1.5">
          <div className="h-6 w-40 animate-pulse rounded-lg bg-white/10" />
          <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="h-[260px] animate-pulse rounded-[28px] bg-surface" />
      <div className="h-32 animate-pulse rounded-3xl bg-surface" />
    </main>
  );
}
