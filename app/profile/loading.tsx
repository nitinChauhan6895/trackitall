export default function ProfileLoading() {
  return (
    <main className="flex flex-1 flex-col px-5 pb-28 safe-top">
      <header className="py-4">
        <div className="h-7 w-28 animate-pulse rounded bg-black/10" />
      </header>
      <div className="flex flex-col items-center pb-6 pt-2">
        <div className="h-20 w-20 animate-pulse rounded-full bg-black/10" />
        <div className="mt-3 h-5 w-32 animate-pulse rounded bg-black/10" />
        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-black/5" />
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-green-tint" />
      <div className="mt-2 h-40 animate-pulse rounded-2xl bg-white" />
    </main>
  );
}
