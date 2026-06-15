// Community tab — placeholder sections. Each is structured so the "Coming soon"
// state can later be swapped for real data once friend/family syncing exists.

type Section = {
  key: string;
  icon: string;
  title: string;
  blurb: string;
};

const SECTIONS: Section[] = [
  {
    key: "leaderboard",
    icon: "📊",
    title: "Leaderboard",
    blurb: "See how your training volume stacks up against friends and family.",
  },
  {
    key: "streaks",
    icon: "🔥",
    title: "Streak award board",
    blurb: "Celebrate the longest active workout streaks in your circle.",
  },
  {
    key: "pr-hall",
    icon: "🏆",
    title: "PR hall of fame",
    blurb: "The biggest personal records across everyone you follow.",
  },
];

export default function Community() {
  return (
    <div className="mt-4 space-y-4">
      {SECTIONS.map((s) => (
        <section
          key={s.key}
          className="rounded-2xl border border-black/5 bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <span aria-hidden>{s.icon}</span> {s.title}
            </h2>
            <span className="rounded-full bg-beige px-2.5 py-1 text-xs font-medium text-muted">
              Coming soon
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{s.blurb}</p>
        </section>
      ))}
    </div>
  );
}
