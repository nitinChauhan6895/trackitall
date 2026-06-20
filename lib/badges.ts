// Achievement badges. A badge "glows" once its criteria are met, otherwise it
// shows locked (blurred). Criteria are evaluated against aggregate stats.

export type BadgeStats = {
  totalWorkouts: number; // distinct days with a logged workout
  currentStreak: number; // active consecutive-day streak ending today/yesterday
  longestStreak: number; // longest run of consecutive workout days
  maxWorkoutsInWeek: number; // most workout days in any rolling 7-day window
  hasPerfectWeek: boolean; // every day of a Mon–Sun calendar week trained
  longestGapDays: number; // biggest gap between consecutive workout days
  maxRunKm: number; // best single running distance (km)
  totalCardioKm: number; // total cardio distance (km) all-time
  cardioSessions: number; // distinct days with a cardio/HIIT session
  strengthSessions: number; // distinct days with a strength session
  maxDeadliftKg: number; // heaviest deadlift set
  maxGroupsInDay: number; // most distinct muscle groups trained in a single day
  pbBeaten: boolean; // improved a previously-set PR
  prCount: number;
};

export type BadgeProgress = { current: number; target: number; unit: string };

export type BadgeDef = {
  id: string;
  label: string;
  icon: string;
  description: string;
  progress: (s: BadgeStats) => BadgeProgress;
};

export type EvaluatedBadge = Omit<BadgeDef, "progress"> &
  BadgeProgress & { earned: boolean; earnedDate: string | null };

const bool = (flag: boolean): BadgeProgress => ({
  current: flag ? 1 : 0,
  target: 1,
  unit: "",
});

export const BADGES: BadgeDef[] = [
  { id: "streak3", label: "3-Day Streak", icon: "🔥", description: "3 days in a row", progress: (s) => ({ current: s.longestStreak, target: 3, unit: "days" }) },
  { id: "streak5", label: "5-Day Streak", icon: "🔥", description: "5 days in a row", progress: (s) => ({ current: s.longestStreak, target: 5, unit: "days" }) },
  { id: "run3k", label: "3K Runner", icon: "🏃", description: "Complete a 3 km run", progress: (s) => ({ current: s.maxRunKm, target: 3, unit: "km" }) },
  { id: "run5k", label: "5K Runner", icon: "🏃", description: "Complete a 5 km run", progress: (s) => ({ current: s.maxRunKm, target: 5, unit: "km" }) },
  { id: "deadlift100", label: "100kg Deadlift", icon: "🏋️", description: "Deadlift 100 kg", progress: (s) => ({ current: s.maxDeadliftKg, target: 100, unit: "kg" }) },
  { id: "weekWarrior", label: "Week Warrior", icon: "🗓️", description: "7 workouts in a week", progress: (s) => ({ current: s.maxWorkoutsInWeek, target: 7, unit: "days" }) },
  { id: "ironRookie", label: "Iron Rookie", icon: "💪", description: "First 10 strength sessions", progress: (s) => ({ current: s.strengthSessions, target: 10, unit: "sessions" }) },
  { id: "cardioCrusher", label: "Cardio Crusher", icon: "🌡️", description: "100 km of cardio total", progress: (s) => ({ current: s.totalCardioKm, target: 100, unit: "km" }) },
  { id: "halfCentury", label: "Half Century", icon: "🏅", description: "50 workouts", progress: (s) => ({ current: s.totalWorkouts, target: 50, unit: "workouts" }) },
  { id: "variety", label: "Variety Master", icon: "🎨", description: "5 muscle groups in a day", progress: (s) => ({ current: s.maxGroupsInDay, target: 5, unit: "groups" }) },
  { id: "perfectWeek", label: "Perfect Week", icon: "✅", description: "Train all 7 days of a week", progress: (s) => bool(s.hasPerfectWeek) },
  { id: "comeback", label: "Comeback Kid", icon: "🔄", description: "Return after 14+ day break", progress: (s) => bool(s.longestGapDays >= 15) },
  { id: "cardioKing", label: "Cardio King", icon: "👟", description: "15 cardio sessions", progress: (s) => ({ current: s.cardioSessions, target: 15, unit: "sessions" }) },
  { id: "firstRep", label: "First Rep", icon: "🎉", description: "Your first workout", progress: (s) => ({ current: s.totalWorkouts, target: 1, unit: "workout" }) },
  { id: "personalBest", label: "Personal Best", icon: "🏆", description: "Beat a previous best", progress: (s) => bool(s.pbBeaten) },
  { id: "century", label: "Century Club", icon: "💯", description: "100 workouts", progress: (s) => ({ current: s.totalWorkouts, target: 100, unit: "workouts" }) },
  { id: "unstoppable", label: "Unstoppable", icon: "⚡", description: "30-day streak", progress: (s) => ({ current: s.longestStreak, target: 30, unit: "days" }) },
];

export function evaluateBadges(
  s: BadgeStats,
  earnedDates: Record<string, string | null> = {},
): EvaluatedBadge[] {
  return BADGES.map(({ progress, ...rest }) => {
    const p = progress(s);
    return {
      ...rest,
      ...p,
      earned: p.current >= p.target,
      earnedDate: earnedDates[rest.id] ?? null,
    };
  });
}

// Earned badges first (preserving order), then locked — handy for previews.
export function sortedByEarned(badges: EvaluatedBadge[]): EvaluatedBadge[] {
  return [...badges].sort((a, b) => Number(b.earned) - Number(a.earned));
}

const DAY = 86400000;

function toDayMs(dateKeys: string[]): number[] {
  return Array.from(new Set(dateKeys))
    .map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    })
    .sort((a, b) => a - b);
}

// Longest run of consecutive calendar days within a set of YYYY-MM-DD keys.
export function longestStreak(dateKeys: string[]): number {
  const days = toDayMs(dateKeys);
  if (days.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] === DAY) run++;
    else run = 1;
    if (run > best) best = run;
  }
  return best;
}

// Active streak: consecutive days ending today (or yesterday if not trained yet).
export function currentStreak(dateKeys: string[], todayKey: string): number {
  const set = new Set(dateKeys);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  let cursor = Date.UTC(ty, tm - 1, td);
  if (!set.has(msToKey(cursor))) {
    cursor -= DAY; // allow a not-yet-trained today
    if (!set.has(msToKey(cursor))) return 0;
  }
  let count = 0;
  while (set.has(msToKey(cursor))) {
    count++;
    cursor -= DAY;
  }
  return count;
}

function msToKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Most distinct workout days inside any rolling window (default 7 days).
export function maxWorkoutsInWindow(dateKeys: string[], windowDays = 7): number {
  const ms = toDayMs(dateKeys);
  let best = 0;
  for (let i = 0; i < ms.length; i++) {
    let count = 0;
    for (let j = i; j < ms.length && ms[j] <= ms[i] + (windowDays - 1) * DAY; j++) {
      count++;
    }
    if (count > best) best = count;
  }
  return best;
}

// Biggest gap (in days) between consecutive workout days.
export function longestGapDays(dateKeys: string[]): number {
  const ms = toDayMs(dateKeys);
  let best = 0;
  for (let i = 1; i < ms.length; i++) {
    best = Math.max(best, (ms[i] - ms[i - 1]) / DAY);
  }
  return best;
}

// True if every day of some Mon–Sun calendar week was trained.
export function hasPerfectWeek(dateKeys: string[]): boolean {
  const ms = toDayMs(dateKeys);
  const weeks = new Map<number, Set<number>>();
  for (const t of ms) {
    const dow = new Date(t).getUTCDay(); // 0 = Sun
    const monday = t - ((dow + 6) % 7) * DAY;
    if (!weeks.has(monday)) weeks.set(monday, new Set());
    weeks.get(monday)!.add(t);
  }
  for (const set of weeks.values()) if (set.size >= 7) return true;
  return false;
}
