export default function GoalsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="space-y-2 px-1 pt-5">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-56 animate-pulse rounded bg-white/10" />
      </header>
      <div className="h-[54px] animate-pulse rounded-[18px] bg-surface" />
      <div className="h-[230px] animate-pulse rounded-[28px] bg-surface" />
      <div className="h-80 animate-pulse rounded-3xl bg-surface" />
    </main>
  );
}
