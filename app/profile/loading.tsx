export default function ProfileLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-36 safe-top">
      <div className="mx-1 mt-5 h-9 w-32 animate-pulse rounded-lg bg-white/10" />
      <div className="h-[250px] animate-pulse rounded-[28px] bg-surface" />
      <div className="h-[170px] animate-pulse rounded-3xl bg-surface" />
      <div className="h-[170px] animate-pulse rounded-3xl bg-surface" />
    </main>
  );
}
