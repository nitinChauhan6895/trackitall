// Offline write queue. When a mutation can't reach the server because the
// device is offline, it's stored in IndexedDB and replayed (in order) once the
// connection returns. The queue — not the UI — is the source of truth for
// pending writes, so they sync even if the user navigated away.
//
// Semantics: at-least-once. We only enqueue when navigator.onLine is false
// (the request provably never left the device), which avoids double-applying an
// ambiguous flaky-online request.

import { get, set } from "idb-keyval";
import {
  addSet,
  deleteExercise,
  deleteGroup,
  deleteSet,
  upsertExercise,
} from "@/app/actions";
import { getBrowserClient } from "@/lib/supabase/client";

const KEY = "trackitall-offline-queue";

export type OpType =
  | "upsertExercise"
  | "addSet"
  | "deleteSet"
  | "deleteExercise"
  | "deleteGroup";

export type QueuedOp = {
  id: string;
  type: OpType;
  payload: any;
  createdAt: number;
  /** Owner at enqueue time — a shared device must never replay these under
   *  a different account. */
  userId?: string | null;
};

async function currentUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await getBrowserClient().auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();
let flushing = false;

async function readQueue(): Promise<QueuedOp[]> {
  return (await get<QueuedOp[]>(KEY)) ?? [];
}
async function writeQueue(q: QueuedOp[]) {
  await set(KEY, q);
  listeners.forEach((l) => l(q.length));
}

/** Re-read the queue and notify listeners.
 *
 *  Needed because Background Sync drains the queue from the service worker,
 *  writing IndexedDB directly — the page's own writeQueue() never runs, so
 *  nothing would tell the UI the pending count changed. */
export async function refreshQueueCount(): Promise<number> {
  const q = await readQueue();
  listeners.forEach((l) => l(q.length));
  return q.length;
}

export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  readQueue().then((q) => l(q.length));
  return () => {
    listeners.delete(l);
  };
}

// Ask the browser to replay the queue in the background, even if the app is
// closed by then. Chromium-only: on iOS Safari registration simply isn't
// available, and the queue still flushes via the 'online' listener the next
// time the app is opened.
async function requestBackgroundSync(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const reg: any = await navigator.serviceWorker.ready;
    if (!reg?.sync) return;
    await reg.sync.register("tia-flush");
  } catch {
    // Permission denied or unsupported — the foreground flush still covers us.
  }
}

export async function enqueue(type: QueuedOp["type"], payload: any): Promise<void> {
  const [q, userId] = await Promise.all([readQueue(), currentUserId()]);
  q.push({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    type,
    payload,
    createdAt: Date.now(),
    userId,
  });
  await writeQueue(q);
  await requestBackgroundSync();
}

// Form-action payloads are stored as plain field maps (FormData isn't
// serialisable), and rebuilt when the op runs.
function toFormData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v ?? "");
  return fd;
}

// Server actions keyed by op type. Add new offline-capable mutations here.
const dispatch: Record<OpType, (payload: any) => Promise<unknown>> = {
  upsertExercise: (p) => upsertExercise(p),
  addSet: (p) => addSet(toFormData(p)),
  deleteSet: (p) => deleteSet(toFormData(p)),
  deleteExercise: (p) => deleteExercise(toFormData(p)),
  deleteGroup: (p) => deleteGroup(p.date, p.group),
};

// Single path for running a mutation, used both live and when replaying the
// queue — so online and offline behaviour can never drift apart.
export function runOp(type: OpType, payload: any): Promise<unknown> {
  return dispatch[type](payload);
}

export const isOffline = () =>
  typeof navigator !== "undefined" && !navigator.onLine;

// Replay queued ops oldest-first. Stops at the first failure (keeps that op and
// the rest for the next attempt). No-op while offline or already flushing.
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { flushed: 0, remaining: (await readQueue()).length };
  }
  flushing = true;
  let flushed = 0;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return { flushed: 0, remaining: 0 };

    const me = await currentUserId();
    // Signed out — hold everything until the owner is back.
    if (!me) return { flushed: 0, remaining: queue.length };

    const remaining: QueuedOp[] = [];
    let halted = false;
    for (const op of queue) {
      // Another account's write, or we already hit a failure: keep it in order.
      if (halted || (op.userId && op.userId !== me)) {
        remaining.push(op);
        continue;
      }
      try {
        await dispatch[op.type](op.payload);
        flushed++;
      } catch {
        remaining.push(op);
        halted = true; // preserve ordering — retry this and the rest later
      }
    }
    await writeQueue(remaining);
    return { flushed, remaining: remaining.length };
  } finally {
    flushing = false;
  }
}
