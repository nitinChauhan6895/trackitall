import Link from "next/link";
import { getBadgeData } from "@/lib/data";
import { evaluateBadges } from "@/lib/badges";
import { Badge } from "@/components/Badge";

export default async function BadgesPage() {
  const { stats, earnedDates } = await getBadgeData();
  const badges = evaluateBadges(stats, earnedDates);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <main className="flex flex-1 flex-col px-4 pb-16 safe-top">
      <header className="flex items-center gap-3 py-4">
        <Link
          href="/"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl active:bg-black/5"
        >
          ←
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden>🏅</span> Badges
        </h1>
      </header>

      <p className="mb-5 text-sm text-muted">
        {earnedCount} of {badges.length} earned
      </p>

      <div className="grid grid-cols-3 gap-x-3 gap-y-6">
        {badges.map((b) => (
          <div key={b.id} className="flex flex-col items-center gap-1">
            <Badge badge={b} />
            <p className="max-w-[6rem] text-center text-[11px] leading-tight text-muted">
              {b.description}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
