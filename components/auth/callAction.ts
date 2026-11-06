import { NETWORK_MESSAGE, type AuthResult } from "@/lib/auth/errors";

/** Runs a server action; a failed request (offline, server down) becomes a result too. */
export async function callAction(fn: () => Promise<AuthResult>): Promise<AuthResult> {
  try {
    return await fn();
  } catch {
    return { ok: false, code: "network", message: NETWORK_MESSAGE };
  }
}
