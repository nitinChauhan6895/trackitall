"use client";

import { useRouter } from "next/navigation";
import SwipeToDelete from "@/components/SwipeToDelete";
import { deleteSet } from "@/app/actions";

export default function SwipeSetRow({
  id,
  date,
  left,
  right,
}: {
  id: string;
  date: string;
  left: string;
  right: string;
}) {
  const router = useRouter();

  async function remove() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("date", date);
    await deleteSet(fd);
    router.refresh();
  }

  return (
    <SwipeToDelete onDelete={remove}>
      {(requestDelete) => (
        <div className="flex items-center justify-between bg-beige px-4 py-3 text-sm">
          <span className="text-muted">{left}</span>
          <span className="flex items-center gap-3">
            <span className="tabular-nums">{right}</span>
            <button
              type="button"
              onClick={requestDelete}
              aria-label="Delete set"
              className="text-muted active:text-orange"
            >
              ✕
            </button>
          </span>
        </div>
      )}
    </SwipeToDelete>
  );
}
