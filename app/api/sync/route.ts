// Replay endpoint for the offline write queue.
//
// The service worker can't invoke Server Actions — those are addressed by an
// action id baked into the client bundle, which a worker has no access to. So
// Background Sync posts the queued ops here instead, and this route runs the
// exact same action functions the app calls when online. One code path, no
// drift between live writes and replayed ones.
//
// Auth comes from the session cookie, which the worker's fetch sends because
// it's a same-origin request with credentials.

import { NextResponse } from "next/server";
import {
  addSet,
  deleteExercise,
  deleteGroup,
  deleteSet,
  upsertExercise,
} from "@/app/actions";
import { getLocalUser } from "@/lib/supabase/user";

type OpType =
  | "upsertExercise"
  | "addSet"
  | "deleteSet"
  | "deleteExercise"
  | "deleteGroup";

type Op = { id: string; type: OpType; payload: any; userId?: string | null };

/**
 * Per-op outcome, positionally matching the ops that were sent.
 *   ok   — applied, drop it
 *   drop — will never apply (unknown type), drop it so it can't wedge the queue
 *   keep — not ours to run right now, keep for later
 *   fail — errored, keep and retry
 */
type Status = "ok" | "drop" | "keep" | "fail";

function toFormData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields ?? {})) fd.append(k, v ?? "");
  return fd;
}

const dispatch: Record<OpType, (payload: any) => Promise<unknown>> = {
  upsertExercise: (p) => upsertExercise(p),
  addSet: (p) => addSet(toFormData(p)),
  deleteSet: (p) => deleteSet(toFormData(p)),
  deleteExercise: (p) => deleteExercise(toFormData(p)),
  deleteGroup: (p) => deleteGroup(p.date, p.group),
};

export async function POST(request: Request) {
  const user = getLocalUser();
  // 401 tells the worker to keep the queue and retry after the next sign-in,
  // rather than discarding writes it can't attribute.
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let ops: Op[];
  try {
    const body = await request.json();
    ops = Array.isArray(body?.ops) ? body.ops : [];
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const statuses: Status[] = [];
  let halted = false;

  for (const op of ops) {
    // Ordering matters (a set references the exercise added before it), so once
    // one op fails everything after it waits for the next attempt.
    if (halted) {
      statuses.push("fail");
      continue;
    }
    // Shared device: never replay another account's writes under this session.
    // Held, not discarded — they run when that account signs back in.
    if (op.userId && op.userId !== user.id) {
      statuses.push("keep");
      continue;
    }
    const run = dispatch[op.type];
    if (!run) {
      // Unknown op from a newer/older build — drop it rather than wedging the
      // queue forever behind something this server will never understand.
      statuses.push("drop");
      continue;
    }
    try {
      await run(op.payload);
      statuses.push("ok");
    } catch {
      statuses.push("fail");
      halted = true;
    }
  }

  return NextResponse.json({ statuses });
}
