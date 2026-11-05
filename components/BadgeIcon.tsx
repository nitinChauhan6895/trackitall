// Line icons for badges (24×24, stroked in currentColor), keyed by badge id.
// Replaces the emoji in BADGES so badges match the rest of the UI.

const PATHS: Record<string, React.ReactNode> = {
  flame: <path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 2 1.5 3 2.5 3 0-3-1-6 0-9z" />,
  runner: (
    <>
      <circle cx="14" cy="4" r="2" />
      <path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 3 3 1M11 15l-2-4" />
    </>
  ),
  dumbbell: <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M9 15l2 2 4-4" />
    </>
  ),
  pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  medal: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M8.5 14L7 22l5-3 5 3-1.5-8" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  rotate: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4" />
    </>
  ),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
};

const ICON_FOR: Record<string, keyof typeof PATHS> = {
  streak3: "flame",
  streak5: "flame",
  run3k: "runner",
  run5k: "runner",
  deadlift100: "dumbbell",
  weekWarrior: "calendar",
  ironRookie: "dumbbell",
  cardioCrusher: "pulse",
  halfCentury: "medal",
  variety: "grid",
  perfectWeek: "calendarCheck",
  comeback: "rotate",
  cardioKing: "pulse",
  firstRep: "star",
  personalBest: "trophy",
  century: "medal",
  unstoppable: "bolt",
};

export default function BadgeIcon({ id, size }: { id: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[ICON_FOR[id] ?? "medal"]}
    </svg>
  );
}
