import { APP_VERSION } from "@/lib/version";

/** Wordmark + two-line headline + one elevated card: every auth screen. */
export default function AuthShell({
  line1,
  line2,
  subtitle,
  children,
  footer,
  showVersion,
}: {
  line1: string;
  line2: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showVersion?: boolean;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col px-5 pb-10 safe-top">
      <p className="pt-6 font-display text-lg font-bold tracking-[-0.01em]" aria-label="TrackItAll">
        TrackIt<span className="text-green">All</span>
      </p>

      <header className="mt-10 flex flex-col gap-2.5 px-1">
        <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-[-0.03em]">
          {line1}
          <br />
          <span className="text-green">{line2}</span>
        </h1>
        {subtitle && <p className="text-[15px] leading-[1.45] text-muted">{subtitle}</p>}
      </header>

      <div className="elevation-1 mt-7 flex flex-col gap-4 rounded-[28px] p-5">{children}</div>

      {footer && <div className="mt-6 flex flex-col items-center gap-3">{footer}</div>}

      {showVersion && (
        <p className="mt-auto pt-10 text-center text-xs text-subtle">TrackItAll · v{APP_VERSION}</p>
      )}
    </main>
  );
}
