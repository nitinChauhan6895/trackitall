import { PASSWORD_RULES } from "@/lib/auth/validation";

/** Rules go from muted to green as they're met. Optional "Passwords match" row. */
export default function PasswordChecklist({ password, confirm }: { password: string; confirm?: string }) {
  const rows = PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, met: r.test(password) }));
  if (confirm !== undefined) {
    rows.push({ id: "match", label: "Passwords match", met: confirm.length > 0 && confirm === password });
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Password requirements">
      {rows.map((r) => (
        <li key={r.id} className={`flex items-center gap-2 text-[13px] ${r.met ? "text-green" : "text-muted"}`}>
          <span
            aria-hidden
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${r.met ? "border-green bg-green text-ink-inverse" : "border-white/20"}`}
          >
            {r.met && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </span>
          {r.label}
          <span className="sr-only">{r.met ? "(done)" : "(not yet)"}</span>
        </li>
      ))}
    </ul>
  );
}
