// Reminder sender. Triggered hourly from outside (GitHub Actions — Vercel's
// Hobby plan can't run cron this often).
//
// For each subscribed device it works out the local wall-clock time in that
// device's own zone, finds habits whose reminder falls in the window since the
// last run, skips the ones already done, and pushes.
//
// Idempotent by construction: a row in habit_notifications is claimed BEFORE
// sending, and its (habit_id, local_date) primary key means a second run — or
// two overlapping runs — simply loses the race and sends nothing.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  configurePush,
  isDue,
  localNow,
  parseReminderMinutes,
  sendPush,
  type PushSubscriptionRow,
} from "@/lib/push";
import { isComplete, type Habit, type HabitLog } from "@/lib/habits";

// web-push needs Node APIs; the Edge runtime can't run it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How far past a reminder we'll still deliver it, covering a late trigger. */
const WINDOW_MINUTES = 60;

function authorized(request: Request): boolean {
  const secret = process.env.PUSH_CRON_SECRET;
  // Without a configured secret the endpoint stays shut rather than open.
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/** Configuration check. Same bearer token, no sends, no data returned —
 *  just which pieces are wired up, so a broken deploy can be diagnosed
 *  without reading server logs. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const env = {
    vapidPublic: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
    vapidSubject: !!process.env.VAPID_SUBJECT,
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  let database = "not checked";
  let devices = 0;
  // Which reminders exist and when they next fall due, so "nothing sent" can be
  // told apart from "nothing is subscribed" or "no reminder is set".
  const reminders: { name: string; at: string; timezone: string; localNow: string; due: boolean }[] = [];

  if (env.supabaseUrl && env.serviceRoleKey) {
    try {
      const supabase = createAdminClient();
      const { data: subs, error } = await supabase
        .from("push_subscriptions")
        .select("user_id, timezone");
      database = error ? `error: ${error.message}` : "ok";
      devices = subs?.length ?? 0;

      if (!error && subs?.length) {
        const now = new Date();
        for (const sub of subs) {
          const { minutes } = localNow(sub.timezone, now);
          const { data: hs } = await supabase
            .from("habits")
            .select("name, reminder_time")
            .eq("user_id", sub.user_id)
            .eq("archived", false)
            .not("reminder_time", "is", null);
          for (const h of hs ?? []) {
            const at = parseReminderMinutes(h.reminder_time as string);
            if (at == null) continue;
            const hh = Math.floor(minutes / 60);
            reminders.push({
              name: h.name as string,
              at: h.reminder_time as string,
              timezone: sub.timezone,
              localNow: `${String(hh).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
              due: isDue(at, minutes, WINDOW_MINUTES),
            });
          }
        }
      }
    } catch (e: any) {
      database = `error: ${String(e?.message ?? e)}`;
    }
  }
  return NextResponse.json({ env, database, devices, reminders });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Anything below can throw (missing env, database error). Without this the
  // caller gets a bare 500 with an empty body and nothing to act on — which is
  // exactly how this route first failed in production.
  try {
    return await run();
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? e), stage: "run" },
      { status: 500 },
    );
  }
}

async function run() {
  if (!configurePush()) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, timezone");
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ sent: 0, checked: 0 });

  // One device per user is the norm, but a user with several devices should get
  // one push each — grouped so habits are fetched once per user.
  const byUser = new Map<string, PushSubscriptionRow[]>();
  for (const s of subs as PushSubscriptionRow[]) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  let sent = 0;
  let checked = 0;
  const dead: string[] = [];

  for (const [userId, devices] of byUser) {
    const { data: habits } = await supabase
      .from("habits")
      .select(
        "id, name, description, icon, color, cadence, kind, category, target_per_period, unit, reminder_time, archived, position",
      )
      .eq("user_id", userId)
      .eq("archived", false);
    if (!habits?.length) continue;

    const withReminder = (habits as Habit[]).filter((h) => h.reminder_time);
    if (withReminder.length === 0) continue;

    for (const device of devices) {
      const { date: localDate, minutes: nowMinutes } = localNow(device.timezone, now);

      // Today's logs, to skip habits already done.
      const { data: logs } = await supabase
        .from("habit_logs")
        .select("habit_id, log_date, count, note")
        .eq("user_id", userId)
        .eq("log_date", localDate);

      for (const habit of withReminder) {
        const at = parseReminderMinutes(habit.reminder_time);
        if (at == null || !isDue(at, nowMinutes, WINDOW_MINUTES)) continue;
        checked++;
        if (isComplete(habit, (logs ?? []) as HabitLog[], localDate)) continue;

        // Claim the slot first — if this conflicts, another run already sent it.
        const { error: claimErr } = await supabase
          .from("habit_notifications")
          .insert({ habit_id: habit.id, user_id: userId, local_date: localDate });
        if (claimErr) continue; // duplicate key: already notified today

        const result = await sendPush(device, {
          title: `${habit.icon ?? "⏰"} ${habit.name}`,
          body: habit.description?.trim() || "Time for your habit.",
          url: "/habits",
          tag: `habit-${habit.id}-${localDate}`,
        });

        if (result.ok) {
          sent++;
        } else {
          // Send failed after claiming — release the claim so a later run can
          // retry, unless the subscription itself is gone.
          await supabase
            .from("habit_notifications")
            .delete()
            .eq("habit_id", habit.id)
            .eq("local_date", localDate);
          if (result.gone) dead.push(device.endpoint);
        }
      }
    }
  }

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({ sent, checked, pruned: dead.length });
}
