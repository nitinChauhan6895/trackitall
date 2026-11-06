export default function NutritionLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      <header className="flex items-center gap-3 pt-4">
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
        <div className="h-7 flex-1 animate-pulse rounded-lg bg-white/10" />
        <div className="h-11 w-24 animate-pulse rounded-full bg-white/10" />
      </header>
      <div className="h-12 animate-pulse rounded-full bg-surface" />
      <div className="h-[290px] animate-pulse rounded-[28px] bg-surface" />
      <div className="h-80 animate-pulse rounded-3xl bg-surface" />
    </main>
  );
}
