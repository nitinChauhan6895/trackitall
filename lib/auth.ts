// Usernames are mapped to a hidden synthetic email so we can use Supabase's
// email/password auth without collecting a real email address.
export const USERNAME_EMAIL_DOMAIN = "trackitall.local";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,30}$/.test(username);
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}
