export default function HabitsLoading() {
  return (
    <main className="flex flex-1 flex-col px-4 pb-28 safe-top">
      <div className="py-5">
        <div className="h-8 w-32 rounded-lg bg-white/[0.06]" />
        <div className="mt-2 h-4 w-44 rounded bg-white/[0.04]" />
      </div>
      <div className="h-32 rounded-2xl bg-white/[0.05]" />
      <div className="mt-4 h-10 rounded-xl bg-white/[0.05]" />
      <div className="mt-5 space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[70px] rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    </main>
  );
}
