// Offline write queue. When a mutation can't reach the server because the
// device is offline, it's stored in IndexedDB and replayed (in order) once the
// connection returns. The queue — not the UI — is the source of truth for
// pending writes, so they sync even if the user navigated away.
//
// Semantics: at-least-once. We only enqueue when navigator.onLine is false
// (the request provably never left the device), which avoids double-applying an
// ambiguous flaky-online request.

import { get, set } from "idb-keyval";
import { upsertExercise } from "@/app/actions";

const KEY = "trackitall-offline-queue";

export type QueuedOp = {
  id: string;
  type: "upsertExercise";
  payload: any;
  createdAt: number;
};

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

export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  readQueue().then((q) => l(q.length));
  return () => {
    listeners.delete(l);
  };
}

export async function enqueue(type: QueuedOp["type"], payload: any): Promise<void> {
  const q = await readQueue();
  q.push({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    type,
    payload,
    createdAt: Date.now(),
  });
  await writeQueue(q);
}

// Server actions keyed by op type. Add new offline-capable mutations here.
const dispatch: Record<QueuedOp["type"], (payload: any) => Promise<unknown>> = {
  upsertExercise: (p) => upsertExercise(p),
};

// Replay queued ops oldest-first. Stops at the first failure (keeps that op and
// the rest for the next attempt). No-op while offline or already flushing.
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { flushed: 0, remaining: (await readQueue()).length };
  }
  flushing = true;
  let flushed = 0;
  try {
    let q = await readQueue();
    while (q.length) {
      const op = q[0];
      try {
        await dispatch[op.type](op.payload);
      } catch {
        break; // network (or other) failure — retry later
      }
      q = q.slice(1);
      await writeQueue(q);
      flushed++;
    }
    return { flushed, remaining: q.length };
  } finally {
    flushing = false;
  }
}
