"use client";

// Browser side of push notifications.
//
// Deliberately small and defensive: every step here can be unavailable
// (unsupported browser, denied permission, iOS Safari outside an installed
// PWA), and the UI needs to explain which rather than silently doing nothing.

/** VAPID public keys are base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: string };

/** Is push usable here, and if not, why? */
export function checkPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "" };
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "This browser doesn't support service workers." };
  }
  if (!("PushManager" in window) || !("Notification" in window)) {
    // iOS Safari only exposes PushManager to an installed PWA, so this is the
    // common case on iPhone: add to Home Screen first.
    const w = window as any;
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      w.navigator?.standalone === true ||
      w.matchMedia?.("(display-mode: standalone)")?.matches === true;
    if (iOS && !standalone) {
      return {
        supported: false,
        reason:
          "On iPhone, notifications only work once the app is added to your Home Screen. Tap Share → Add to Home Screen, then open it from there.",
      };
    }
    return { supported: false, reason: "This browser doesn't support notifications." };
  }
  return { supported: true };
}

export function notificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

/** True if this device already has a live subscription. */
export async function isSubscribed(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export type SubscribeResult = { ok: true } | { ok: false; error: string };

export async function subscribeToPush(): Promise<SubscribeResult> {
  const support = checkPushSupport();
  if (!support.supported) return { ok: false, error: support.reason };

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, error: "Notifications aren't configured on the server yet." };

  // Must be called from a user gesture — both iOS and Chrome reject otherwise.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      error:
        permission === "denied"
          ? "Notifications are blocked. Enable them for this app in your browser or system settings."
          : "Notification permission wasn't granted.",
    };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        // Required: every push must result in a visible notification.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      }));

    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: json.keys,
        // The device knows its own zone; an IANA name survives DST, an offset
        // would not.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    });
    if (!res.ok) {
      return { ok: false, error: "Couldn't save the subscription. Try again." };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Couldn't enable notifications." };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // Already gone — nothing to undo.
  }
}
