import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS — use ONLY in server code that has no user
 * session and legitimately needs to act across accounts, which today means the
 * reminder sender deciding whose habits are due.
 *
 * SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser: no
 * NEXT_PUBLIC_ prefix, set in Vercel's env vars, kept in the gitignored
 * .env.local locally.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role credentials are not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
