/**
 * The polite live region every auth form announces errors and confirmations
 * through. Always mounted, so screen readers catch changes to its text.
 */
export default function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children?: React.ReactNode;
}) {
  return (
    <div aria-live="polite" role="status" className="empty:hidden">
      {children ? (
        <p className="flex items-start gap-2 text-[13px] leading-[1.4] text-ink">
          <span
            aria-hidden
            className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "error" ? "bg-gold" : "bg-green"}`}
          />
          <span className="flex flex-wrap items-baseline gap-x-2">{children}</span>
        </p>
      ) : null}
    </div>
  );
}
