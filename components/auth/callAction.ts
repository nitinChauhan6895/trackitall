import { NETWORK_MESSAGE, type AuthResult } from "@/lib/auth/errors";

/**
 * Runs a server action; a failed request becomes a result too.
 *
 * After a new deploy, a page loaded from the previous build can't reach its
 * server actions any more ("Failed to find Server Action"). Rather than show
 * a misleading connection error, reload onto the new build.
 */
export async function callAction(fn: () => Promise<AuthResult>): Promise<AuthResult> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/server action/i.test(msg) && typeof window !== "undefined") {
      setTimeout(() => window.location.reload(), 1200);
      return { ok: false, code: "stale", message: "TrackItAll was just updated. Reloading…" };
    }
    return { ok: false, code: "network", message: NETWORK_MESSAGE };
  }
}
