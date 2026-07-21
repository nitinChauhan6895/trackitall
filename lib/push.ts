// Web-push helpers shared by the subscribe and send routes.
//
// Server-only: importing this from a client component would pull the private
// VAPID key into the bundle.

import webpush from "web-push";

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
};

let configured = false;

/** Configure web-push once per process. Returns false if keys are missing. */
export function configurePush(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where to go when the notification is tapped. */
  url?: string;
  /** Collapses repeats of the same reminder on the device. */
  tag?: string;
};

/** Outcome of one send, so the caller can prune subscriptions that are gone. */
export type SendResult = { ok: true } | { ok: false; gone: boolean; error: string };

export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600 },
    );
    return { ok: true };
  } catch (e: any) {
    // 404/410 mean the browser threw the subscription away (app uninstalled,
    // permission revoked). Those rows are dead and should be deleted rather
    // than retried forever.
    const status = e?.statusCode;
    return {
      ok: false,
      gone: status === 404 || status === 410,
      error: String(e?.message ?? e),
    };
  }
}

/**
 * The wall-clock time in a given IANA zone, as { date: "YYYY-MM-DD",
 * minutes: since midnight }.
 *
 * Derived with Intl rather than an offset: offsets drift with DST, and the
 * server runs in UTC while the user is in IST — the mismatch that has caused
 * every date bug in this app so far.
 */
export function localNow(timeZone: string, now = new Date()) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
  } catch {
    // Unknown zone (corrupt row) — fall back to UTC rather than throwing and
    // stalling everyone else's reminders.
    return localNow("UTC", now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  };
}

/** "08:30" -> 510. Returns null for anything unparseable. */
export function parseReminderMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Is a reminder due now?
 *
 * `windowMinutes` covers the gap between trigger runs: an hourly job that fires
 * late must still deliver an 08:30 reminder at 08:47. Firing late is much better
 * than not firing, and the per-day unique constraint stops duplicates.
 */
export function isDue(
  reminderMinutes: number,
  nowMinutes: number,
  windowMinutes: number,
): boolean {
  const delta = nowMinutes - reminderMinutes;
  return delta >= 0 && delta < windowMinutes;
}
