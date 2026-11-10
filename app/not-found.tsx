import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] flex-1 flex-col justify-center gap-6 px-5 pb-24 safe-top">
      <div className="flex flex-col gap-2.5 px-1">
        <h1 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-0.03em]">
          Page not
          <br />
          <span className="text-green">found.</span>
        </h1>
        <p className="text-[15px] leading-[1.45] text-muted">That page doesn&apos;t exist, or it has moved.</p>
      </div>
      <div className="elevation-1 rounded-[28px] p-5">
        <Link
          href="/"
          className="flex h-[52px] w-full items-center justify-center rounded-full bg-green text-base font-semibold text-ink-inverse active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Go to Home
        </Link>
      </div>
    </main>
  );
}
