/** A neutral 13px message with a gold dot: the app never shows errors in red. */
export default function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-2 text-[13px] leading-[1.4] text-ink">
      <span aria-hidden className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
      <span>{children}</span>
    </p>
  );
}
