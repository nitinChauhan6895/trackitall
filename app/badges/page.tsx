import Link from "next/link";
import { getBadgeData } from "@/lib/data";
import { evaluateBadges, type EvaluatedBadge } from "@/lib/badges";
import { formatShortDate } from "@/lib/dateFormat";
import BadgeIcon from "@/components/BadgeIcon";

export default async function BadgesPage() {
  const { stats, earnedDates } = await getBadgeData();
  const badges = evaluateBadges(stats, earnedDates);
  const earned = badges.filter((b) => b.earned);
  // Closest to done first.
  const inProgress = badges.filter((b) => !b.earned).sort((a, b) => frac(b) - frac(a));
  // "Next up" is the nearest badge with a measurable target (yes/no badges
  // like Perfect Week have no count to show).
  const nextUp = inProgress.find((b) => b.unit !== "");

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-36 safe-top">
      {/* Top bar */}
      <div className="flex items-center gap-3 pt-4">
        <Link
          href="/"
          aria-label="Back"
          className="elevation-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-ink active:bg-white/15"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-display text-[30px] font-bold tracking-[-0.02em]">Badges</h1>
      </div>

      {/* Hero */}
      <section className="elevation-1 flex flex-col gap-4 rounded-[28px] px-5 pb-5 pt-[22px]">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted">COLLECTION</span>
            <span className="font-display text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">
              {earned.length}
              <span className="text-2xl font-semibold text-subtle"> / {badges.length}</span>
            </span>
            <span className="text-[15px] text-[#D4D4D4]">badges earned</span>
          </div>
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-gold bg-gold/[0.14] text-gold">
            <BadgeIcon id="halfCentury" size={28} />
          </span>
        </div>
        <ProgressBar frac={earned.length / badges.length} height="h-2" />
        {nextUp && (
          <div className="elevation-2 flex items-center gap-3 rounded-2xl px-3.5 py-3">
            <span className="shrink-0 rounded-lg bg-green px-2 py-1 text-[11px] font-bold tracking-[0.06em] text-ink-inverse">
              NEXT UP
            </span>
            <span className="min-w-0 flex-1 text-sm">
              {nextUp.label} · {toGo(nextUp)}
            </span>
          </div>
        )}
      </section>

      {earned.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Earned" count={earned.length} />
          <div className="grid grid-cols-2 gap-3">
            {earned.map((b) => (
              <div key={b.id} className="elevation-1 flex flex-col gap-3 rounded-3xl p-[18px]">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-gold bg-gold/[0.14] text-gold">
                  <BadgeIcon id={b.id} size={24} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold">{b.label}</span>
                  <span className="text-[13px] text-muted">{b.description}</span>
                </span>
                <span className="text-xs font-medium text-gold">
                  {b.earnedDate ? formatShortDate(b.earnedDate) : "Earned"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="In progress" count={inProgress.length} />
          <div className="elevation-1 flex flex-col rounded-3xl">
            {inProgress.map((b) => (
              <div key={b.id} className="flex gap-3.5 border-b border-surface-2 px-[18px] py-4 last:border-0">
                <span className="elevation-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted">
                  <BadgeIcon id={b.id} size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-semibold">{b.label}</span>
                    <span className="whitespace-nowrap text-[13px] text-muted">
                      {b.unit === "" ? (
                        "Not yet"
                      ) : (
                        <>
                          <span className={`font-semibold ${b.current > 0 ? "text-green" : "text-ink"}`}>
                            {fmtNum(b.current)}
                          </span>{" "}
                          / {b.target} {b.unit}
                        </>
                      )}
                    </span>
                  </span>
                  <ProgressBar frac={frac(b)} height="h-1.5" />
                  <span className="text-[13px] text-muted">{b.description}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <span className="text-sm text-muted">{count}</span>
    </div>
  );
}

function ProgressBar({ frac, height }: { frac: number; height: string }) {
  return (
    <div className={`${height} rounded-full bg-[#2C2C2C]`}>
      {frac > 0 && (
        <div
          className={`${height} rounded-full bg-green`}
          style={{ width: `${Math.min(100, frac * 100)}%` }}
        />
      )}
    </div>
  );
}

function frac(b: EvaluatedBadge): number {
  return b.target > 0 ? Math.min(1, b.current / b.target) : 0;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// "1 day to go", "2.3 km to go".
function toGo(b: EvaluatedBadge): string {
  const left = Math.max(0, b.target - b.current);
  const unit = left === 1 ? b.unit.replace(/s$/, "") : b.unit;
  return `${fmtNum(left)} ${unit} to go`;
}
