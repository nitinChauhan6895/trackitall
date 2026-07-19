import type { MuscleGroup } from "@/lib/types";

// Accent color per group (used for the icon stroke).
// Distinct hue per group (no two alike) spread around the color wheel.
export const MUSCLE_TONE: Record<MuscleGroup, string> = {
  chest: "#E04F3D", // red
  tricep: "#EE7A2E", // orange
  shoulders: "#E0A52A", // gold
  legs: "#C9B028", // olive
  functional: "#5BA12E", // lime
  core: "#2E9E6B", // emerald
  cardio: "#1FA6A0", // teal
  back: "#2F80C2", // blue
  bicep: "#5A6FE0", // indigo
  forearms: "#7B5AD9", // violet
  olympic: "#9B5CC9", // purple
  hiit: "#D6489E", // magenta
};

const COMMON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Paths({ group }: { group: MuscleGroup }) {
  switch (group) {
    case "chest":
      return (
        <>
          <path d="M4 7c3-2 5-2 8 0c3-2 5-2 8 0v3c0 4-3 6-8 6s-8-2-8-6V7z" />
          <path d="M12 7v9" />
        </>
      );
    case "tricep":
    case "bicep":
      return (
        <>
          <path d="M6 4v5a4 4 0 0 0 4 4h1a4 4 0 0 1 4 4v3" />
          <circle cx="6" cy="4" r="1.4" />
          <path d="M9 9c1.5-1 3.5-1 5 0" />
        </>
      );
    case "back":
      return (
        <>
          <path d="M5 5h14l-2.5 7c-1 2.5-2.5 4-4.5 4s-3.5-1.5-4.5-4L5 5z" />
          <path d="M12 5v15" />
        </>
      );
    case "shoulders":
      return (
        <>
          <path d="M4 14a8 8 0 0 1 16 0" />
          <circle cx="5.5" cy="14" r="2.4" />
          <circle cx="18.5" cy="14" r="2.4" />
        </>
      );
    case "legs":
      return (
        <>
          <path d="M8 3h8" />
          <path d="M10 3l-.5 8L7 21" />
          <path d="M14 3l.5 8L17 21" />
        </>
      );
    case "core":
      return (
        <>
          <rect x="7" y="4" width="10" height="16" rx="3.5" />
          <path d="M12 4v16M7 9.5h10M7 14.5h10" />
        </>
      );
    case "functional":
      return (
        <>
          <circle cx="14" cy="5" r="1.7" />
          <path d="M14 7l-2.5 4 3.5 2.5V20" />
          <path d="M11.5 11L7 12.5" />
          <path d="M15 13.5l3.5 2" />
        </>
      );
    case "cardio":
      return <path d="M2 12h4.5l2-5 3.5 10 2.5-6 1.5 1H22" />;
    case "hiit":
      return <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />;
    case "olympic":
      return (
        <>
          <path d="M3 9v6M6 7v10M18 7v10M21 9v6" />
          <path d="M6 12h12" />
        </>
      );
  }
}

export default function MuscleIcon({
  group,
  className,
}: {
  group: MuscleGroup;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      className={className}
      aria-hidden
      {...COMMON}
    >
      <Paths group={group} />
    </svg>
  );
}
