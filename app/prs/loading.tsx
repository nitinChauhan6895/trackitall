export default function PrsLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <header className="flex items-center gap-3 py-4">
        <div className="h-9 w-9 animate-pulse rounded-full bg-black/10" />
        <div className="h-5 w-32 animate-pulse rounded bg-black/10" />
      </header>
      <div className="mb-4 h-12 animate-pulse rounded-2xl bg-orange-soft" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-orange-soft" />
        ))}
      </div>
    </main>
  );
}
