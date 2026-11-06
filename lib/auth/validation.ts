// Client- and server-safe auth validation. The same rules are configured in
// Supabase (Auth → Providers → Email → password requirements), which is the
// real gate; these exist so the form can say what's missing before a round-trip.

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,30}$/.test(username);
}

export type PasswordRule = { id: string; label: string; test: (p: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "letter", label: "Contains a letter", test: (p) => /[A-Za-z]/.test(p) },
  { id: "number", label: "Contains a number", test: (p) => /\d/.test(p) },
];

export function isStrongPassword(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p));
}

/** A 6-digit email code, as typed or pasted (spaces and dashes ignored). */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}
