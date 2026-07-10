export default function NutritionLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center justify-between py-4">
        <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
        <div className="h-9 w-28 animate-pulse rounded-full bg-white/10" />
      </header>
      <div className="mb-4 h-44 animate-pulse rounded-2xl bg-surface" />
      <div className="mb-4 h-24 animate-pulse rounded-2xl bg-surface" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-3 h-24 animate-pulse rounded-2xl bg-surface" />
      ))}
    </main>
  );
}
