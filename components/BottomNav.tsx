"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toDateKey } from "@/lib/date";

// Routes that should NOT show the app nav (auth screens + full-screen flows that
// carry their own bottom action bar — revisited in the day-view round).
const HIDDEN = ["/login", "/signup", "/verify-email", "/forgot", "/reset", "/reset-password", "/auth", "/log", "/day", "/prs", "/nutrition/search"];

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
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md items-center gap-2.5 px-4 pb-7 safe-bottom"
    >
      {/* Floating "liquid glass" tab bar with the log action beside it. */}
      <div className="grid h-16 flex-1 grid-cols-4 elevation-3 rounded-full bg-[rgba(44,44,44,0.62)] p-1.5 backdrop-saturate-[1.6]">
        <NavItem href="/" label="Home" active={isActive("/")} icon={HomeIcon} />
        <NavItem href="/habits" label="Habits" active={isActive("/habits")} icon={LeafIcon} />
        <NavItem href="/stats" label="Stats" active={isActive("/stats")} icon={StatsIcon} />
        <NavItem href="/goals" label="Goals" active={isActive("/goals")} icon={GoalIcon} />
      </div>
      <Link
        href={today ? `/log/${today}` : "/"}
        aria-label="Log workout"
        className="flex h-16 w-16 flex-none items-center justify-center elevation-3 rounded-full bg-green/[0.92] text-ink-inverse transition active:scale-95"
      >
        <PlusIcon />
      </Link>
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
        "flex flex-col items-center justify-center gap-0.5 rounded-full text-[10px] transition",
        active ? "bg-white/10 font-semibold text-green" : "font-medium text-[#D4D4D4]",
      ].join(" ")}
    >
      <span className="h-5 w-5">
        <Icon />
      </span>
      {label}
    </Link>
  );
}

const svg = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
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
function GoalIcon() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
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
