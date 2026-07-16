import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Shared singleton browser client for React Query fetchers. Reads the auth
// session from cookies; RLS enforces access exactly as on the server.
let shared: ReturnType<typeof createBrowserClient> | undefined;
export function getBrowserClient() {
  if (!shared) shared = createClient();
  return shared;
}
