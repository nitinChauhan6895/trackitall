// Community tab — placeholder sections. Each is structured so the "Coming soon"
// state can later be swapped for real data once friend/family syncing exists.

type Section = {
  key: string;
  title: string;
  blurb: string;
};

const SECTIONS: Section[] = [
  {
    key: "leaderboard",
    title: "Leaderboard",
    blurb: "See how your training volume stacks up against friends and family.",
  },
  {
    key: "streaks",
    title: "Streak award board",
    blurb: "Celebrate the longest active workout streaks in your circle.",
  },
  {
    key: "pr-hall",
    title: "PR hall of fame",
    blurb: "The biggest personal records across everyone you follow.",
  },
];

export default function Community() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl font-semibold">Coming soon</h2>
        <span className="text-sm text-muted">{SECTIONS.length}</span>
      </div>
      {SECTIONS.map((s) => (
        <div key={s.key} className="elevation-1 flex flex-col gap-2 rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[22px] font-semibold">{s.title}</h3>
            <span className="elevation-2 shrink-0 rounded-full px-[9px] py-[5px] text-[11px] font-semibold tracking-[0.06em] text-muted">
              SOON
            </span>
          </div>
          <p className="text-sm leading-[1.45] text-muted">{s.blurb}</p>
        </div>
      ))}
    </section>
  );
}
