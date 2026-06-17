"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toDateKey } from "@/lib/date";

// Routes that should NOT show the app nav (auth screens + full-screen flows that
// carry their own bottom action bar — revisited in the day-view round).
const HIDDEN = ["/login", "/forgot", "/reset", "/auth", "/log", "/day"];

export default function BottomNav() {
  const path = usePathname() ?? "/";
  if (HIDDEN.some((p) => path === p || path.startsWith(p + "/"))) return null;

  const today = toDateKey(new Date());
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-black/5 bg-page/95 backdrop-blur safe-bottom">
      <div className="grid grid-cols-5 items-end px-2 pb-1.5 pt-2">
        <NavItem href="/" label="Home" active={isActive("/")} icon={HomeIcon} />
        <NavItem href="/community" label="Community" active={isActive("/community")} icon={PeopleIcon} />

        <div className="flex justify-center">
          <Link
            href={`/log/${today}`}
            aria-label="Log workout"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-green text-white shadow-lg ring-4 ring-page transition active:scale-95"
          >
            <PlusIcon />
          </Link>
        </div>

        <NavItem href="/stats" label="Stats" active={isActive("/stats")} icon={StatsIcon} />
        <NavItem href="/profile" label="Profile" active={isActive("/profile")} icon={PersonIcon} />
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
function PeopleIcon() {
  return (
    <svg {...svg}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-5-5.9" />
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
function PersonIcon() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
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
