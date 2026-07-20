"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toDateKey } from "@/lib/date";

// Routes that should NOT show the app nav (auth screens + full-screen flows that
// carry their own bottom action bar — revisited in the day-view round).
const HIDDEN = ["/login", "/forgot", "/reset", "/auth", "/log", "/day"];

export default function BottomNav() {
  const path = usePathname() ?? "/";

  // The + button's date must come from the DEVICE, after mount. Rendering
  // new Date() directly bakes the server's UTC date into the SSR'd (and
  // SW-cached) HTML — a stale href that opens yesterday's log at night, and a
  // hydration mismatch when the device disagrees. Recomputed per navigation so
  // a session left open across midnight stays fresh.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(toDateKey(new Date()));
  }, [path]);

  if (HIDDEN.some((p) => path === p || path.startsWith(p + "/"))) return null;
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-3 safe-bottom">
      <div className="grid grid-cols-5 items-center rounded-[28px] border border-white/10 bg-surface px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
        <NavItem href="/" label="Home" active={isActive("/")} icon={HomeIcon} />
        <NavItem href="/habits" label="Habits" active={isActive("/habits")} icon={LeafIcon} />

        <div className="flex justify-center">
          <Link
            href={today ? `/log/${today}` : "/"}
            aria-label="Log workout"
            className="-mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-green text-ink-inverse shadow-lg ring-4 ring-surface transition active:scale-95"
          >
            <PlusIcon />
          </Link>
        </div>

        <NavItem href="/stats" label="Stats" active={isActive("/stats")} icon={StatsIcon} />
        <NavItem href="/coach" label="Coach" active={isActive("/coach")} icon={CoachIcon} />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: () => JSX.Element;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center gap-1 py-1 text-[11px] font-medium transition",
        active ? "text-orange" : "text-muted",
      ].join(" ")}
    >
      <span className="h-6 w-6">
        <Icon />
      </span>
      {label}
    </Link>
  );
}

const svg = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  width: "100%",
  height: "100%",
};

function HomeIcon() {
  return (
    <svg {...svg}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function LeafIcon() {
  return (
    <svg {...svg}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}
function StatsIcon() {
  return (
    <svg {...svg}>
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  );
}
function CoachIcon() {
  return (
    <svg {...svg}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3.2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V4" />
      <path d="M8.5 12.5l2 2 4.5-4.5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
