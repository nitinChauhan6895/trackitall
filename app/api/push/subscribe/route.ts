// Register (or refresh) this device's push subscription.
//
// Called after the user grants notification permission. Upserts on endpoint so
// re-subscribing on the same device updates the row instead of accumulating
// dead ones.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLocalUser } from "@/lib/supabase/user";

export async function POST(request: Request) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const endpoint = String(body?.endpoint ?? "");
  const p256dh = String(body?.keys?.p256dh ?? "");
  const auth = String(body?.keys?.auth ?? "");
  const timezone = String(body?.timezone ?? "UTC").slice(0, 64);
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "incomplete subscription" }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      timezone,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = getLocalUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  let endpoint = "";
  try {
    endpoint = String((await request.json())?.endpoint ?? "");
  } catch {}
  if (!endpoint) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = createClient();
  // RLS restricts this to the caller's own rows.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
