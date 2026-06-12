"use client";

import { useRouter } from "next/navigation";
import SwipeToDelete from "@/components/SwipeToDelete";
import { deleteExercise } from "@/app/actions";

export default function SwipeExerciseHeader({
  id,
  date,
  name,
}: {
  id: string;
  date: string;
  name: string;
}) {
  const router = useRouter();

  async function remove() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("date", date);
    await deleteExercise(fd);
    router.refresh();
  }

  return (
    <SwipeToDelete onDelete={remove} label="Delete exercise">
      {(requestDelete) => (
        <div className="flex items-center justify-between bg-white py-0.5">
          <h3 className="font-semibold">{name}</h3>
          <button
            type="button"
            onClick={requestDelete}
            aria-label="Delete exercise"
            className="text-muted active:text-orange"
          >
            ✕
          </button>
        </div>
      )}
    </SwipeToDelete>
  );
}
