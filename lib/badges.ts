// Achievement badges. A badge "glows" once its criteria are met, otherwise it
// shows locked (blurred). Criteria are evaluated against aggregate stats.

export type BadgeStats = {
  totalWorkouts: number; // distinct days with a logged workout
  longestStreak: number; // longest run of consecutive workout days
  maxWorkoutsInWeek: number; // most workout days in any rolling 7-day window
  hasPerfectWeek: boolean; // every day of a Mon–Sun calendar week trained
  longestGapDays: number; // biggest gap between consecutive workout days
  maxRunKm: number; // best single running distance (km)
  totalCardioKm: number; // total cardio distance (km) all-time
  cardioSessions: number; // distinct days with a cardio/HIIT session
  strengthSessions: number; // distinct days with a strength session
  maxDeadliftKg: number; // heaviest deadlift set
  categories: number; // distinct muscle groups ever trained
  pbBeaten: boolean; // improved a previously-set PR
  prCount: number;
};

export type BadgeDef = {
  id: string;
  label: string;
  icon: string;
  description: string;
  earned: (s: BadgeStats) => boolean;
};

export type EvaluatedBadge = Omit<BadgeDef, "earned"> & { earned: boolean };

export const BADGES: BadgeDef[] = [
  { id: "streak3", label: "3-Day Streak", icon: "🔥", description: "3 days in a row", earned: (s) => s.longestStreak >= 3 },
  { id: "streak5", label: "5-Day Streak", icon: "🔥", description: "5 days in a row", earned: (s) => s.longestStreak >= 5 },
  { id: "run3k", label: "3K Runner", icon: "🏃", description: "Complete a 3 km run", earned: (s) => s.maxRunKm >= 3 },
  { id: "run5k", label: "5K Runner", icon: "🏃", description: "Complete a 5 km run", earned: (s) => s.maxRunKm >= 5 },
  { id: "deadlift100", label: "100kg Deadlift", icon: "🏋️", description: "Deadlift 100 kg", earned: (s) => s.maxDeadliftKg >= 100 },
  { id: "weekWarrior", label: "Week Warrior", icon: "🗓️", description: "7 workouts in a week", earned: (s) => s.maxWorkoutsInWeek >= 7 },
  { id: "ironRookie", label: "Iron Rookie", icon: "💪", description: "First 10 strength sessions", earned: (s) => s.strengthSessions >= 10 },
  { id: "cardioCrusher", label: "Cardio Crusher", icon: "🌡️", description: "100 km of cardio total", earned: (s) => s.totalCardioKm >= 100 },
  { id: "halfCentury", label: "Half Century", icon: "🏅", description: "50 workouts", earned: (s) => s.totalWorkouts >= 50 },
  { id: "variety", label: "Variety Master", icon: "🎨", description: "5 different categories", earned: (s) => s.categories >= 5 },
  { id: "perfectWeek", label: "Perfect Week", icon: "✅", description: "Train all 7 days of a week", earned: (s) => s.hasPerfectWeek },
  { id: "comeback", label: "Comeback Kid", icon: "🔄", description: "Return after 14+ day break", earned: (s) => s.longestGapDays >= 15 },
  { id: "cardioKing", label: "Cardio King", icon: "👟", description: "15 cardio sessions", earned: (s) => s.cardioSessions >= 15 },
  { id: "firstRep", label: "First Rep", icon: "🎉", description: "Your first workout", earned: (s) => s.totalWorkouts >= 1 },
  { id: "personalBest", label: "Personal Best", icon: "🏆", description: "Beat a previous best", earned: (s) => s.pbBeaten },
  { id: "century", label: "Century Club", icon: "💯", description: "100 workouts", earned: (s) => s.totalWorkouts >= 100 },
  { id: "unstoppable", label: "Unstoppable", icon: "⚡", description: "30-day streak", earned: (s) => s.longestStreak >= 30 },
];

export function evaluateBadges(s: BadgeStats): EvaluatedBadge[] {
  return BADGES.map(({ earned, ...rest }) => ({ ...rest, earned: earned(s) }));
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
