export function PrimaryButton({
  loading,
  loadingLabel = "Please wait…",
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "h-[52px] w-full rounded-full bg-green text-base font-semibold text-ink-inverse transition active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100",
        className ?? "",
      ].join(" ")}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function SecondaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={[
        "h-[52px] w-full rounded-full border border-white/[0.12] bg-transparent text-[15px] font-semibold text-ink active:bg-white/[0.06] disabled:opacity-50",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** A green text button with a 44px touch target. */
export function TextButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        "inline-flex min-h-11 items-center justify-center px-2 text-[15px] font-semibold text-green active:opacity-70 disabled:text-muted disabled:opacity-100",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
